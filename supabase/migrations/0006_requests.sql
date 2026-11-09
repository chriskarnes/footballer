-- The front door: trainers asking for an academy, players asking to join one.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor after 0005.
--
--   academy_requests  "Get started" from train.futbol/start. Anyone can send
--                     one; only platform admins read them. An academy is still
--                     made by hand with create_academy() once you've talked.
--   join_requests     A player who found their trainer (rather than being sent
--                     an invite link) asks to join. The academy's trainers
--                     approve or decline from the dashboard.
--   academies.city / .listed
--                     What "Find your trainer" searches. Listed by default;
--                     a trainer who'd rather not be found is switched off.

-- ------------------------------------------------------------- FINDABLE ---
alter table academies add column if not exists city   text check (city is null or char_length(city) <= 60);
alter table academies add column if not exists listed boolean not null default true;
grant select (city, listed) on academies to anon, authenticated;
grant update (city, listed) on academies to authenticated;

-- Search by the academy's name, address or town. Only listed academies, at
-- most ten, and only what a search result shows.
create or replace function public.find_academies(p_q text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by r->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('slug', slug, 'name', name, 'city', city) as r
    from academies
    where listed and char_length(trim(p_q)) >= 2
      and (name ilike '%' || trim(p_q) || '%' or slug ilike '%' || trim(p_q) || '%'
           or city ilike '%' || trim(p_q) || '%')
    limit 10
  ) s;
$$;

-- --------------------------------------------------------- GET STARTED ---
create table if not exists academy_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  email        text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  academy_name text not null check (char_length(academy_name) between 1 and 40),
  slug         text check (slug is null or slug ~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$'),
  city         text check (city is null or char_length(city) <= 60),
  players      text check (players is null or char_length(players) <= 20),
  trainers     text check (trainers is null or char_length(trainers) <= 20),
  content      text check (content is null or char_length(content) <= 40),
  message      text check (message is null or char_length(message) <= 2000),
  status       text not null default 'new' check (status in ('new','contacted','set_up','declined')),
  created_at   timestamptz not null default now()
);
alter table academy_requests enable row level security;
revoke all on academy_requests from anon, authenticated;
grant select, update (status) on academy_requests to authenticated;
drop policy if exists "requests admin read" on academy_requests;
create policy "requests admin read" on academy_requests for select using (public.is_admin());
drop policy if exists "requests admin update" on academy_requests;
create policy "requests admin update" on academy_requests for update
  using (public.is_admin()) with check (public.is_admin());

-- The only way in: a function, so a signed-out visitor can send one without
-- being able to read anyone else's. A crude brake on a form left open to the
-- internet: one request per email per hour.
create or replace function public.request_academy(
  p_name text, p_email text, p_academy_name text, p_slug text, p_city text,
  p_players text, p_trainers text, p_content text, p_message text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from academy_requests where lower(email) = lower(trim(p_email))
             and created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into academy_requests (name, email, academy_name, slug, city, players, trainers, content, message)
  values (trim(p_name), lower(trim(p_email)), trim(p_academy_name), nullif(lower(trim(p_slug)), ''),
          nullif(trim(p_city), ''), nullif(p_players, ''), nullif(p_trainers, ''), nullif(p_content, ''),
          nullif(trim(p_message), ''));
end; $$;

-- -------------------------------------------------------- ASKING TO JOIN ---
create table if not exists join_requests (
  academy_id uuid not null references academies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- Who they say they are. The trainer may not recognise an email address.
  name       text not null check (char_length(name) between 1 and 80),
  message    text check (message is null or char_length(message) <= 300),
  created_at timestamptz not null default now(),
  primary key (academy_id, user_id)
);
alter table join_requests enable row level security;
revoke all on join_requests from anon, authenticated;
grant select on join_requests to authenticated;
drop policy if exists "join requests read" on join_requests;
create policy "join requests read" on join_requests for select
  using (user_id = auth.uid() or public.is_staff(academy_id));

-- Asks to join the academy on this address. Already a member: nothing to ask.
-- Asking again replaces the earlier note.
create or replace function public.request_to_join(p_slug text, p_name text, p_message text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  a uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into a from academies where slug = p_slug;
  if a is null then raise exception 'academy not found'; end if;
  if exists (select 1 from academy_members where academy_id = a and user_id = auth.uid()) then
    return 'member';
  end if;
  insert into join_requests (academy_id, user_id, name, message)
  values (a, auth.uid(), trim(p_name), nullif(trim(p_message), ''))
  on conflict (academy_id, user_id) do update
    set name = excluded.name, message = excluded.message, created_at = now();
  return 'requested';
end; $$;

-- A trainer answers. Yes makes them a player; either way the request goes.
create or replace function public.answer_join_request(p_academy uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(p_academy) then raise exception 'not staff'; end if;
  if not exists (select 1 from join_requests where academy_id = p_academy and user_id = p_user) then
    raise exception 'no such request';
  end if;
  if p_approve then
    insert into academy_members (academy_id, user_id, role) values (p_academy, p_user, 'player')
    on conflict do nothing;
  end if;
  delete from join_requests where academy_id = p_academy and user_id = p_user;
end; $$;

revoke all on function public.find_academies(text), public.request_academy(text,text,text,text,text,text,text,text,text),
  public.request_to_join(text,text,text), public.answer_join_request(uuid,uuid,boolean) from public;
grant execute on function public.find_academies(text),
  public.request_academy(text,text,text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.request_to_join(text,text,text),
  public.answer_join_request(uuid,uuid,boolean) to authenticated;
