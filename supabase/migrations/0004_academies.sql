-- Academies: one per trainer business, each on its own subdomain.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor, or:
--
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0004_academies.sql
--
-- Needs 0002 (admins, is_admin) and 0003 to have run. Moves the single
-- branding row into an academy called `demo`, makes every admin its owner and
-- every other existing account one of its players, so nothing changes for
-- anyone already on demo.train.futbol.
--
-- Trainers read their players through security-definer functions below, not
-- through new policies on workouts, plans or profiles. A policy there would
-- also widen a trainer's own unfiltered queries ("my workouts") to include
-- their players'.

-- --------------------------------------------------------------- ACADEMIES ---
create table if not exists academies (
  id            uuid primary key default gen_random_uuid(),
  -- The subdomain. Lowercase letters, digits and inner hyphens, 3–30 long,
  -- and none of the names the platform keeps for itself.
  slug          text not null unique
                check (slug ~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$'
                  and slug not in ('www','app','api','admin','auth','mail','email','help','support',
                    'status','blog','docs','static','cdn','assets','dashboard','login','signup',
                    'join','coach','trainer','billing','stripe','ns1','ns2','ftp','smtp',
                    'test','staging','dev','preview')),
  name          text not null check (char_length(name) between 1 and 40),
  -- Where the trainer is. Weeks on the dashboard start on this zone's Monday.
  time_zone     text not null default 'America/New_York',
  -- Branding, as in 0002. Null colours are the monochrome app.
  palette_id    text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color  text check (accent_color  is null or accent_color  ~ '^#[0-9A-Fa-f]{6}$'),
  logo_type     text,
  logo_data     text,
  -- Billing is not built yet; these are here so it can plug in without a
  -- reshuffle. trainer_pays: the trainer is charged per player. players_pay:
  -- players pay the trainer through the app, and the platform takes a fee.
  billing_mode  text not null default 'trainer_pays' check (billing_mode in ('trainer_pays','players_pay')),
  price_cents   int check (price_cents is null or price_cents >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);

create table if not exists academy_members (
  academy_id uuid not null references academies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- owner: pays and runs it. trainer: staff. Both see every player.
  role       text not null check (role in ('owner','trainer','player')),
  joined_at  timestamptz not null default now(),
  primary key (academy_id, user_id)
);
create index if not exists academy_members_user_idx on academy_members (user_id);

-- One live link per role: /join/<code>. Rotating replaces the code.
create table if not exists academy_invites (
  code       text primary key check (char_length(code) >= 8),
  academy_id uuid not null references academies(id) on delete cascade,
  role       text not null check (role in ('trainer','player')),
  created_at timestamptz not null default now(),
  unique (academy_id, role)
);

-- ------------------------------------------------------------------- NOTES ---
-- One-way: trainer to player, no replies. Every staff member can read every
-- note in their academy, and nothing is ever edited or deleted — a record a
-- parent could ask to see.
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  -- Kept as sent: players can't read staff profiles, and a trainer who
  -- leaves should still sign their old notes.
  author_name text not null,
  kind        text not null default 'note' check (kind in ('note','nudge')),
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists notes_academy_idx on notes (academy_id, created_at desc);

create table if not exists note_recipients (
  note_id uuid not null references notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz,
  primary key (note_id, user_id)
);
create index if not exists note_recipients_user_idx on note_recipients (user_id);

-- ---------------------------------------------------------------- HELPERS ---
-- Security definer so policies on academy_members can call them without
-- recursing into themselves.
create or replace function public.academy_role(p_academy uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from academy_members where academy_id = p_academy and user_id = auth.uid();
$$;

create or replace function public.is_staff(p_academy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.academy_role(p_academy) in ('owner','trainer'), false);
$$;

create or replace function public.new_invite_code() returns text
language sql volatile as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
$$;

-- --------------------------------------------------------------------- RLS ---
alter table academies       enable row level security;
alter table academy_members enable row level security;
alter table academy_invites enable row level security;
alter table notes           enable row level security;
alter table note_recipients enable row level security;

-- An academy's face is public: anyone opening its subdomain sees the name,
-- colours and logo. Billing columns are left out of the grant.
revoke select, insert, update, delete on academies from anon, authenticated;
grant select (id, slug, name, time_zone, palette_id, primary_color, accent_color,
              logo_type, logo_data, created_at, updated_at) on academies to anon, authenticated;
grant update (name, time_zone, palette_id, primary_color, accent_color, logo_type, logo_data,
              updated_at, updated_by) on academies to authenticated;

drop policy if exists "academy read" on academies;
create policy "academy read" on academies for select using (true);
drop policy if exists "academy owner write" on academies;
create policy "academy owner write" on academies for update
  using (public.academy_role(id) = 'owner' or public.is_admin())
  with check (public.academy_role(id) = 'owner' or public.is_admin());

-- Your own memberships, or everyone's in an academy you staff. Joining goes
-- through join_academy(); removing is staff removing a player, or the owner
-- removing a trainer.
drop policy if exists "members read" on academy_members;
create policy "members read" on academy_members for select
  using (user_id = auth.uid() or public.is_staff(academy_id));
drop policy if exists "members remove" on academy_members;
create policy "members remove" on academy_members for delete
  using ((role = 'player' and public.is_staff(academy_id))
      or (role = 'trainer' and public.academy_role(academy_id) = 'owner'));

drop policy if exists "invites read" on academy_invites;
create policy "invites read" on academy_invites for select using (public.is_staff(academy_id));

-- Each table's policy needs the other, so the check is one definer function
-- rather than two policies that would recurse into each other.
create or replace function public.can_read_note(p_note uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from note_recipients where note_id = p_note and user_id = auth.uid())
      or exists (select 1 from notes where id = p_note and public.is_staff(academy_id));
$$;

drop policy if exists "notes read" on notes;
create policy "notes read" on notes for select using (public.can_read_note(id));

drop policy if exists "note recipients read" on note_recipients;
create policy "note recipients read" on note_recipients for select
  using (user_id = auth.uid() or public.can_read_note(note_id));

-- ---------------------------------------------------------------- JOINING ---
-- What /join/<code> shows before anyone signs in: whose link it is and what
-- it makes you. Nothing else about the academy.
create or replace function public.invite_preview(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('slug', a.slug, 'name', a.name, 'role', i.role)
  from academy_invites i join academies a on a.id = i.academy_id
  where i.code = p_code;
$$;

-- Joins the signed-in account. Already a member: nothing changes, and a
-- trainer who opens the player link stays a trainer.
create or replace function public.join_academy(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  inv academy_invites;
  existing text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from academy_invites where code = p_code;
  if not found then raise exception 'invite not found'; end if;

  select role into existing from academy_members where academy_id = inv.academy_id and user_id = auth.uid();
  if existing is null then
    insert into academy_members (academy_id, user_id, role) values (inv.academy_id, auth.uid(), inv.role);
    existing := inv.role;
  elsif existing = 'player' and inv.role = 'trainer' then
    update academy_members set role = 'trainer' where academy_id = inv.academy_id and user_id = auth.uid();
    existing := 'trainer';
  end if;

  return jsonb_build_object('academy_id', inv.academy_id, 'role', existing,
    'slug', (select slug from academies where id = inv.academy_id));
end; $$;

-- A new link for a role; the old one stops working. Staff can rotate the
-- player link, only the owner the trainer link.
create or replace function public.rotate_invite(p_academy uuid, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare
  c text := public.new_invite_code();
begin
  if p_role = 'player' and not public.is_staff(p_academy) then raise exception 'not staff'; end if;
  if p_role = 'trainer' and public.academy_role(p_academy) <> 'owner' then raise exception 'not the owner'; end if;
  if p_role not in ('player','trainer') then raise exception 'bad role'; end if;
  insert into academy_invites (code, academy_id, role) values (c, p_academy, p_role)
  on conflict (academy_id, role) do update set code = excluded.code, created_at = now();
  return c;
end; $$;

-- Platform admins create academies for now; the caller becomes its owner.
-- Self-serve signup later only has to loosen the first check.
create or replace function public.create_academy(p_slug text, p_name text, p_owner uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a uuid;
begin
  if not public.is_admin() and auth.role() <> 'service_role' then raise exception 'not an admin'; end if;
  insert into academies (slug, name) values (lower(p_slug), p_name) returning id into a;
  insert into academy_members (academy_id, user_id, role) values (a, coalesce(p_owner, auth.uid()), 'owner');
  insert into academy_invites (code, academy_id, role) values
    (public.new_invite_code(), a, 'player'), (public.new_invite_code(), a, 'trainer');
  return a;
end; $$;

-- ---------------------------------------------------------- TRAINER VIEWS ---
-- Everything the dashboard needs about an academy's players, in one call:
-- who they are, their active week, and what they've finished since p_since.
-- With p_player, just that one player.
create or replace function public.academy_players(p_academy uuid, p_since timestamptz, p_player uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(p_academy) then raise exception 'not staff'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',      m.user_id,
      'joined_at',    m.joined_at,
      'email',        u.email,
      'display_name', p.display_name,
      'positions',    p.positions,
      'age_band',     p.age_band,
      'plan_name',    pl.name,
      'plan_days',    coalesce((
        select jsonb_agg(jsonb_build_object('weekday', d.weekday, 'slot', d.slot, 'kind', d.kind, 'session_id', d.session_id))
        from plan_days d where d.plan_id = pl.id), '[]'::jsonb),
      'last_done',    (select max(coalesce(w.completed_at, w.created_at)) from workouts w
                        where w.user_id = m.user_id and w.status = 'completed'),
      'done',         coalesce((
        select jsonb_agg(jsonb_build_object(
          'at', coalesce(w.completed_at, w.created_at), 'title', w.title, 'source', w.source,
          'minutes', coalesce(w.actual_minutes, w.planned_minutes),
          'touches', coalesce(w.actual_touches, w.planned_touches))
          order by coalesce(w.completed_at, w.created_at) desc)
        from workouts w
        where w.user_id = m.user_id and w.status = 'completed'
          and coalesce(w.completed_at, w.created_at) >= p_since), '[]'::jsonb)
    ))
    from academy_members m
    join auth.users u on u.id = m.user_id
    left join profiles p on p.id = m.user_id
    left join lateral (select id, name from plans where user_id = m.user_id and active
                       order by created_at desc limit 1) pl on true
    where m.academy_id = p_academy and m.role = 'player'
      and (p_player is null or m.user_id = p_player)
  ), '[]'::jsonb);
end; $$;

-- The staff list for the team page.
create or replace function public.academy_staff(p_academy uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(p_academy) then raise exception 'not staff'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role, 'email', u.email,
                                        'display_name', p.display_name, 'joined_at', m.joined_at)
                     order by m.role = 'owner' desc, m.joined_at)
    from academy_members m join auth.users u on u.id = m.user_id
    left join profiles p on p.id = m.user_id
    where m.academy_id = p_academy and m.role in ('owner','trainer')
  ), '[]'::jsonb);
end; $$;

-- ------------------------------------------------------------ SENDING NOTES ---
-- To the players listed, or with p_to null, every player in the academy.
-- Anyone listed who isn't a player there is quietly left out.
create or replace function public.send_note(p_academy uuid, p_body text, p_to uuid[] default null,
                                            p_kind text default 'note')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  n uuid;
  author text;
begin
  if not public.is_staff(p_academy) then raise exception 'not staff'; end if;
  if char_length(trim(p_body)) = 0 then raise exception 'empty note'; end if;

  select coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1)) into author
  from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid();

  insert into notes (academy_id, author_id, author_name, kind, body)
  values (p_academy, auth.uid(), author, case when p_kind = 'nudge' then 'nudge' else 'note' end, trim(p_body))
  returning id into n;

  insert into note_recipients (note_id, user_id)
  select n, m.user_id from academy_members m
  where m.academy_id = p_academy and m.role = 'player'
    and (p_to is null or m.user_id = any(p_to));

  if not found then raise exception 'no players to send to'; end if;
  return n;
end; $$;

create or replace function public.mark_notes_seen(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update note_recipients set seen_at = now()
  where user_id = auth.uid() and note_id = any(p_ids) and seen_at is null;
$$;

revoke all on function public.academy_role(uuid), public.is_staff(uuid), public.can_read_note(uuid), public.invite_preview(text),
  public.join_academy(text), public.rotate_invite(uuid, text), public.create_academy(text, text, uuid),
  public.academy_players(uuid, timestamptz, uuid), public.academy_staff(uuid),
  public.send_note(uuid, text, uuid[], text), public.mark_notes_seen(uuid[]) from public;
-- The helpers run inside policies, so every caller needs them, anon included.
grant execute on function public.invite_preview(text), public.academy_role(uuid), public.is_staff(uuid),
  public.can_read_note(uuid) to anon, authenticated;
grant execute on function public.academy_role(uuid), public.is_staff(uuid), public.can_read_note(uuid),
  public.join_academy(text),
  public.rotate_invite(uuid, text), public.create_academy(text, text, uuid),
  public.academy_players(uuid, timestamptz, uuid), public.academy_staff(uuid),
  public.send_note(uuid, text, uuid[], text), public.mark_notes_seen(uuid[]) to authenticated;
grant execute on function public.create_academy(text, text, uuid) to service_role;

-- ---------------------------------------------------------- THE DEMO ACADEMY ---
-- The old single brand becomes `demo`; admins own it, everyone else plays.
insert into academies (slug, name, palette_id, primary_color, accent_color, logo_type, logo_data)
select 'demo', coalesce(nullif(trim(b.name), ''), 'Train.futbol'),
       b.palette_id, b.primary_color, b.accent_color, b.logo_type, b.logo_data
from branding b where b.id = 1
on conflict (slug) do nothing;

insert into academies (slug, name) values ('demo', 'Train.futbol') on conflict (slug) do nothing;

insert into academy_members (academy_id, user_id, role)
select a.id, ad.user_id, 'owner' from academies a, admins ad where a.slug = 'demo'
on conflict do nothing;

insert into academy_members (academy_id, user_id, role)
select a.id, p.id, 'player' from academies a, profiles p where a.slug = 'demo'
on conflict do nothing;

insert into academy_invites (code, academy_id, role)
select public.new_invite_code(), a.id, r.role from academies a,
       (values ('player'), ('trainer')) r(role)
where a.slug = 'demo'
on conflict (academy_id, role) do nothing;
