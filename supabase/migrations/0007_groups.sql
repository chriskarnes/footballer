-- Trainer content and groups.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor after 0006.
--
-- An academy's own training, separate from the licensed library tables
-- (programs / sessions / exercises), which stay the demo's alone:
--
--   drills            one exercise: a name, how much ("3 × 50 each foot"),
--                     minutes, an optional video link and how-to.
--   academy_programs  a run of weeks ("Ball Mastery, 8 weeks").
--   academy_sessions  what's done at home in week N of a program: an ordered
--                     list of drills. A week with no sessions repeats the last
--                     week before it that has some, so a trainer can build
--                     week 1 and stop there.
--
-- And who does it:
--
--   groups            a label for players who train together ("U12 Tuesday"),
--                     with an optional meeting slot and one program. A player
--                     can be in any number.
--   group_members
--   player_programs   a program for one player on their own (1-to-1 work).
--   addons            "Just for you": one drill added to one player's week.
--
-- Members read their academy's content; trainers write it. Players see the
-- groups they're in, their own programs and their own add-ons, nothing else.

create or replace function public.is_member(p_academy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.academy_role(p_academy) is not null;
$$;
grant execute on function public.is_member(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- CONTENT ---
create table if not exists drills (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  amount      text check (amount is null or char_length(amount) <= 80),
  minutes     int not null default 5 check (minutes between 1 and 120),
  focus       text check (focus is null or char_length(focus) <= 30),
  video_url   text check (video_url is null or (video_url ~ '^https://' and char_length(video_url) <= 300)),
  how         text check (how is null or char_length(how) <= 1000),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists drills_academy_idx on drills (academy_id);

create table if not exists academy_programs (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 500),
  weeks       int not null default 8 check (weeks between 1 and 52),
  created_at  timestamptz not null default now()
);
create index if not exists academy_programs_academy_idx on academy_programs (academy_id);

create table if not exists academy_sessions (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  program_id  uuid not null references academy_programs(id) on delete cascade,
  week        int not null check (week between 1 and 52),
  position    int not null default 0,
  name        text not null check (char_length(name) between 1 and 60),
  drill_ids   uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists academy_sessions_program_idx on academy_sessions (program_id, week, position);

-- ----------------------------------------------------------------- GROUPS ---
create table if not exists groups (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  -- When they train together, if they do. 0 = Monday.
  meets_weekday int check (meets_weekday between 0 and 6),
  meets_time    text check (meets_time is null or meets_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  program_id    uuid references academy_programs(id) on delete set null,
  -- Week 1 of the program is the Monday-to-Sunday week containing this date.
  starts_on     date,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists groups_academy_idx on groups (academy_id);

create table if not exists group_members (
  group_id   uuid not null references groups(id) on delete cascade,
  academy_id uuid not null references academies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on group_members (user_id);

create table if not exists player_programs (
  academy_id uuid not null references academies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references academy_programs(id) on delete cascade,
  starts_on  date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (user_id, program_id)
);

create table if not exists addons (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  drill_id   uuid not null references drills(id) on delete cascade,
  note       text check (note is null or char_length(note) <= 200),
  -- The Monday of the week it's for.
  week_of    date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists addons_user_idx on addons (user_id, week_of);

-- -------------------------------------------------------------------- RLS ---
alter table drills           enable row level security;
alter table academy_programs enable row level security;
alter table academy_sessions enable row level security;
alter table groups           enable row level security;
alter table group_members    enable row level security;
alter table player_programs  enable row level security;
alter table addons           enable row level security;

revoke all on drills, academy_programs, academy_sessions, groups, group_members, player_programs, addons from anon;
grant select, insert, update, delete on drills, academy_programs, academy_sessions, groups,
  group_members, player_programs, addons to authenticated;

-- Content: every member reads it, staff write it.
do $$
declare t text;
begin
  foreach t in array array['drills','academy_programs','academy_sessions'] loop
    execute format('drop policy if exists "%1$s read" on %1$I', t);
    execute format('create policy "%1$s read" on %1$I for select using (public.is_member(academy_id))', t);
    execute format('drop policy if exists "%1$s write" on %1$I', t);
    execute format('create policy "%1$s write" on %1$I for all using (public.is_staff(academy_id)) with check (public.is_staff(academy_id))', t);
  end loop;
end $$;

-- Who's in what: staff see and change everything; a player sees their own.
drop policy if exists "group members read" on group_members;
create policy "group members read" on group_members for select
  using (user_id = auth.uid() or public.is_staff(academy_id));
drop policy if exists "group members write" on group_members;
create policy "group members write" on group_members for all
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id)
    and exists (select 1 from groups g where g.id = group_id and g.academy_id = group_members.academy_id)
    and exists (select 1 from academy_members m where m.academy_id = group_members.academy_id
                and m.user_id = group_members.user_id and m.role = 'player'));

drop policy if exists "groups read" on groups;
create policy "groups read" on groups for select
  using (public.is_staff(academy_id)
    or exists (select 1 from group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid()));
drop policy if exists "groups write" on groups;
create policy "groups write" on groups for all
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

drop policy if exists "player programs read" on player_programs;
create policy "player programs read" on player_programs for select
  using (user_id = auth.uid() or public.is_staff(academy_id));
drop policy if exists "player programs write" on player_programs;
create policy "player programs write" on player_programs for all
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id)
    and exists (select 1 from academy_programs p where p.id = program_id and p.academy_id = player_programs.academy_id)
    and exists (select 1 from academy_members m where m.academy_id = player_programs.academy_id
                and m.user_id = player_programs.user_id and m.role = 'player'));

drop policy if exists "addons read" on addons;
create policy "addons read" on addons for select
  using (user_id = auth.uid() or public.is_staff(academy_id));
drop policy if exists "addons write" on addons;
create policy "addons write" on addons for all
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id)
    and exists (select 1 from drills d where d.id = drill_id and d.academy_id = addons.academy_id)
    and exists (select 1 from academy_members m where m.academy_id = addons.academy_id
                and m.user_id = addons.user_id and m.role = 'player'));

-- A program's sessions must be in the same academy as the program.
drop policy if exists "academy_sessions write" on academy_sessions;
create policy "academy_sessions write" on academy_sessions for all
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id)
    and exists (select 1 from academy_programs p where p.id = program_id and p.academy_id = academy_sessions.academy_id));

-- A group's program must be the academy's own.
drop policy if exists "groups write" on groups;
create policy "groups write" on groups for all
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id)
    and (program_id is null or exists (select 1 from academy_programs p where p.id = program_id and p.academy_id = groups.academy_id)));

-- What an academy's players finished from their trainer's week, for the
-- dashboard's ticks. Workouts stay owner-only; this is the narrow window.
create or replace function public.academy_completions(p_academy uuid, p_since timestamptz)
returns table (user_id uuid, source text, source_ref text, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select w.user_id, w.source, w.source_ref, w.completed_at
  from workouts w
  join academy_members m on m.user_id = w.user_id and m.academy_id = p_academy and m.role = 'player'
  where public.is_staff(p_academy)
    and w.status = 'completed' and w.source in ('academy', 'addon')
    and w.completed_at >= p_since;
$$;
revoke all on function public.academy_completions(uuid, timestamptz) from public;
grant execute on function public.academy_completions(uuid, timestamptz) to authenticated;

-- The calendar feed's share of the trainer's week: for the feed's owner, in
-- the academy the feed is fetched from, their groups and programs, the
-- sessions and drills those use, and their add-ons. Keyed by the feed token
-- like calendar_feed(), since calendar servers have no session.
create or replace function public.calendar_academy(p_token text, p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  u uuid;
  a uuid;
begin
  select user_id into u from calendar_feeds where token = p_token;
  select id into a from academies where slug = p_slug;
  if u is null or a is null then return null; end if;
  if not exists (select 1 from academy_members where academy_id = a and user_id = u) then return null; end if;

  return jsonb_build_object(
    'user_id', u,
    'time_zone', (select time_zone from academies where id = a),
    'groups', coalesce((select jsonb_agg(to_jsonb(g)) from groups g
      join group_members gm on gm.group_id = g.id and gm.user_id = u
      where g.academy_id = a and not g.archived), '[]'::jsonb),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('group_id', gm.group_id, 'user_id', gm.user_id))
      from group_members gm where gm.academy_id = a and gm.user_id = u), '[]'::jsonb),
    'player_programs', coalesce((select jsonb_agg(jsonb_build_object('user_id', pp.user_id, 'program_id', pp.program_id, 'starts_on', pp.starts_on))
      from player_programs pp where pp.academy_id = a and pp.user_id = u), '[]'::jsonb),
    'programs', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'weeks', p.weeks))
      from academy_programs p where p.academy_id = a), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'program_id', s.program_id, 'week', s.week,
      'position', s.position, 'name', s.name, 'drill_ids', s.drill_ids))
      from academy_sessions s where s.academy_id = a), '[]'::jsonb),
    'drills', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'amount', d.amount, 'minutes', d.minutes,
      'focus', d.focus, 'video_url', null, 'how', null))
      from drills d where d.academy_id = a), '[]'::jsonb),
    'addons', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'user_id', x.user_id, 'drill_id', x.drill_id,
      'note', x.note, 'week_of', x.week_of))
      from addons x where x.academy_id = a and x.user_id = u and x.week_of > current_date - 21), '[]'::jsonb)
  );
end; $$;
revoke all on function public.calendar_academy(text, text) from public;
grant execute on function public.calendar_academy(text, text) to anon, authenticated;
