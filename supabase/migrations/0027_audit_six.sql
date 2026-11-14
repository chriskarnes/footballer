-- 0027: the sixth audit's database side.
--
--   session_academy / elsewhere   Which academy a finished session was for,
--                                 found by primary key (0025 compared ids as
--                                 text, which no index serves, so trainer and
--                                 admin pages slowed as sessions piled up).
--   workouts indexes              Finished sessions by time, and by player.
--   academy_completions           Leaves out sessions done for another academy
--                                 (0025 fixed every other read), oldest first,
--                                 so trainer and player agree which run counts.
--   calendar_academy              A player's own extra is marked as theirs (it
--                                 was read as a trainer-built week and hid the
--                                 program), and a "just for you" drill keeps
--                                 the day it was given.
--   activate_plan                 One active plan, always: switching is one step.
--   workouts / profiles checks    Minutes and touches within reason; a photo's
--                                 type is an image's.
--   add_extra_session             Two quick taps can't pass the extras limit.
--   join requests                 A trainer link asks the owner; a request says
--                                 whether a player or a parent asked; a no is
--                                 kept, so the asker is told.
--   request_academy               A corrected "Get started" within the hour
--                                 replaces the first, rather than vanishing.
--   session_moves                 Staff may clear a player's move, when they
--                                 set that session's day themselves.
--   delete_drill                  Past weeks keep the drill, as history.
--   admin_*                       The panel: faster, paged, and counting the
--                                 right things (see each).
--
-- Safe to run more than once.

-- ------------------------------------------------------------------------
-- Which academy a session was for: a trainer's session, a built week's, an
-- extra or a drill. Null for the player's own (library, Speed, free).
create or replace function public.session_academy(p_source text, p_ref text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  r uuid;
  a uuid;
begin
  if coalesce(p_source, '') not in ('academy', 'addon')
     or p_ref is null or p_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  r := p_ref::uuid;
  select academy_id into a from academy_sessions where id = r;
  if a is null then select academy_id into a from player_week_sessions where id = r; end if;
  if a is null then select academy_id into a from addons where id = r; end if;
  if a is null then select academy_id into a from drills where id = r; end if;
  return a;
end; $$;
revoke all on function public.session_academy(text, text) from public, anon;

create or replace function public.elsewhere(p_academy uuid, p_source text, p_ref text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.session_academy(p_source, p_ref) <> p_academy, false);
$$;
revoke all on function public.elsewhere(uuid, text, text) from public, anon;

-- ------------------------------------------------------------------------
create index if not exists workouts_done_idx
  on workouts ((coalesce(completed_at, created_at))) where status = 'completed';
create index if not exists workouts_user_done_idx
  on workouts (user_id, (coalesce(completed_at, created_at))) where status = 'completed';

-- ------------------------------------------------------------------------
create or replace function public.academy_completions(p_academy uuid, p_since timestamptz)
returns table (user_id uuid, source text, source_ref text, completed_at timestamptz, feel text, done_ids text[])
language sql stable security definer set search_path = public as $$
  select w.user_id, w.source, w.source_ref, w.completed_at, w.feel, w.done_ids
  from workouts w
  join academy_members m on m.user_id = w.user_id and m.academy_id = p_academy and m.role = 'player'
  where public.is_staff(p_academy)
    and w.status = 'completed' and w.source in ('academy', 'addon')
    and w.completed_at >= p_since
    and not public.elsewhere(p_academy, w.source, w.source_ref)
  order by w.completed_at;
$$;
revoke all on function public.academy_completions(uuid, timestamptz) from public, anon;
grant execute on function public.academy_completions(uuid, timestamptz) to authenticated;

-- ------------------------------------------------------------------------
-- As 0021, with made_by, note, steps and light on the week's sessions, and
-- created_at on the extras.
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
      'note', x.note, 'week_of', x.week_of, 'created_at', x.created_at))
      from addons x where x.academy_id = a and x.user_id = u and x.week_of > current_date - 21), '[]'::jsonb),
    'schedules', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'club_days', s.club_days, 'game_day', s.game_day,
      'game_days', s.game_days, 'trainer_days', s.trainer_days))
      from player_schedules s where s.user_id = u), '[]'::jsonb),
    'moves', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'week_of', m.week_of, 'item_key', m.item_key, 'weekday', m.weekday))
      from session_moves m where m.academy_id = a and m.user_id = u and m.week_of > current_date - 21), '[]'::jsonb),
    'custom', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'week_of', c.week_of,
      'position', c.position, 'name', c.name, 'drill_ids', c.drill_ids, 'weekday', c.weekday,
      'made_by', c.made_by, 'note', c.note, 'steps', c.steps, 'light', c.light))
      from player_week_sessions c where c.academy_id = a and c.user_id = u and c.week_of > current_date - 21), '[]'::jsonb)
  );
end; $$;
revoke all on function public.calendar_academy(text, text) from public;
grant execute on function public.calendar_academy(text, text) to anon, authenticated;

-- ------------------------------------------------------------------------
-- One active plan per player. Any second one from before (two quick
-- switches) is turned off, newest kept.
update plans p set active = false
 where p.active and exists (
   select 1 from plans q where q.user_id = p.user_id and q.active
      and (q.created_at > p.created_at or (q.created_at = p.created_at and q.id > p.id)));
create unique index if not exists plans_one_active on plans (user_id) where active;

create or replace function public.activate_plan(p_plan uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('plan:' || auth.uid()::text));
  if not exists (select 1 from plans where id = p_plan and user_id = auth.uid()) then return false; end if;
  update plans set active = false where user_id = auth.uid() and active and id <> p_plan;
  update plans set active = true where id = p_plan;
  return true;
end; $$;
revoke all on function public.activate_plan(uuid) from public, anon;
grant execute on function public.activate_plan(uuid) to authenticated;

-- ------------------------------------------------------------------------
-- Checked from here on (not valid: rows from before aren't re-read).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'workouts_amounts_sane') then
    alter table workouts add constraint workouts_amounts_sane check (
      (actual_minutes  is null or actual_minutes  between 0 and 600) and
      (planned_minutes is null or planned_minutes between 0 and 600) and
      (actual_touches  is null or actual_touches  between 0 and 50000) and
      (planned_touches is null or planned_touches between 0 and 50000)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_type_image') then
    alter table profiles add constraint profiles_avatar_type_image
      check (avatar_type is null or avatar_type in ('image/jpeg', 'image/png', 'image/webp')) not valid;
  end if;
end $$;

-- ------------------------------------------------------------------------
-- As 0015, with a lock per player and academy around the count.
create or replace function public.add_extra_session(
  p_academy uuid, p_week_of date, p_name text, p_drill_ids uuid[], p_steps smallint[], p_weekday smallint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  allowed int;
  used int;
  new_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from academy_members where academy_id = p_academy and user_id = auth.uid() and role = 'player'
  ) then raise exception 'not a player here'; end if;
  if p_week_of > current_date + 1 or p_week_of < current_date - 8 or extract(isodow from p_week_of) <> 1 then
    raise exception 'not this week';
  end if;
  perform pg_advisory_xact_lock(hashtext('extra:' || p_academy::text || ':' || auth.uid()::text));
  select coalesce((select player_extras from academy_plan_defaults where academy_id = p_academy), 0) into allowed;
  select count(*) into used from player_week_sessions
    where academy_id = p_academy and user_id = auth.uid() and week_of = p_week_of and made_by = 'player';
  if used >= allowed then raise exception 'extra limit reached'; end if;
  if cardinality(p_drill_ids) not between 1 and 20
     or (select count(*) from drills where academy_id = p_academy and id = any(p_drill_ids)) <> cardinality(p_drill_ids) then
    raise exception 'bad drills';
  end if;
  insert into player_week_sessions (academy_id, user_id, week_of, position, name, drill_ids, steps, weekday, made_by)
  values (p_academy, auth.uid(), p_week_of, 100 + used, left(p_name, 40), p_drill_ids,
          coalesce(p_steps, '{}'), greatest(0, least(6, p_weekday)), 'player')
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.add_extra_session(uuid, date, text, uuid[], smallint[], smallint) from public, anon;
grant execute on function public.add_extra_session(uuid, date, text, uuid[], smallint[], smallint) to authenticated;

-- ------------------------------------------------------------------------
-- Join requests: as a trainer (from the trainer link), who's asking, and a no.
alter table join_requests add column if not exists role text not null default 'player';
alter table join_requests add column if not exists as_who text;
alter table join_requests add column if not exists declined_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'join_requests_role_check') then
    alter table join_requests add constraint join_requests_role_check check (role in ('player', 'trainer'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'join_requests_as_who_check') then
    alter table join_requests add constraint join_requests_as_who_check check (as_who is null or as_who in ('player', 'parent'));
  end if;
end $$;

-- The player link lets them straight in, as before. The trainer link asks the
-- owner: a forwarded link isn't a key to every player's data.
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

  if inv.role = 'trainer' and coalesce(existing, '') not in ('owner', 'trainer') then
    insert into join_requests (academy_id, user_id, name, role)
    values (inv.academy_id, auth.uid(),
            left(coalesce(nullif(trim((select display_name from profiles where id = auth.uid())), ''),
                          (select email from auth.users where id = auth.uid()), 'Trainer'), 80),
            'trainer')
    on conflict (academy_id, user_id) do update
      set role = 'trainer', declined_at = null, created_at = now();
    return jsonb_build_object('academy_id', inv.academy_id, 'role', 'asked',
      'slug', (select slug from academies where id = inv.academy_id));
  end if;

  if existing is null then
    insert into academy_members (academy_id, user_id, role) values (inv.academy_id, auth.uid(), 'player');
    existing := 'player';
  end if;

  -- In now, so nothing left to ask; their name from the request, if they had none.
  insert into profiles (id, display_name)
    select auth.uid(), r.name from join_requests r
     where r.academy_id = inv.academy_id and r.user_id = auth.uid() and r.role = 'player'
  on conflict (id) do update set display_name = coalesce(nullif(trim(profiles.display_name), ''), excluded.display_name);
  delete from join_requests where academy_id = inv.academy_id and user_id = auth.uid() and role = 'player';

  return jsonb_build_object('academy_id', inv.academy_id, 'role', existing,
    'slug', (select slug from academies where id = inv.academy_id));
end; $$;
revoke all on function public.join_academy(text) from public, anon;
grant execute on function public.join_academy(text) to authenticated;

drop function if exists public.request_to_join(text, text, text);
create or replace function public.request_to_join(p_slug text, p_name text, p_message text default null, p_as text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  a uuid;
  who text := case when p_as in ('player', 'parent') then p_as end;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into a from academies where slug = p_slug;
  if a is null then raise exception 'academy not found'; end if;
  if exists (select 1 from academy_members where academy_id = a and user_id = auth.uid()) then
    return 'member';
  end if;
  insert into join_requests (academy_id, user_id, name, message, as_who, role)
  values (a, auth.uid(), trim(p_name), nullif(trim(p_message), ''), who, 'player')
  on conflict (academy_id, user_id) do update
    set name = excluded.name, message = excluded.message, as_who = coalesce(excluded.as_who, join_requests.as_who),
        role = 'player', declined_at = null, created_at = now();
  -- Whose email this is, so Me asks the right person while they wait. Not
  -- over a trainer's own account.
  if who is not null and not exists (
    select 1 from academy_members where user_id = auth.uid() and role in ('owner', 'trainer')
  ) then
    insert into profiles (id, signed_up_by) values (auth.uid(), who)
    on conflict (id) do update set signed_up_by = coalesce(profiles.signed_up_by, excluded.signed_up_by);
  end if;
  return 'requested';
end; $$;
revoke all on function public.request_to_join(text, text, text, text) from public, anon;
grant execute on function public.request_to_join(text, text, text, text) to authenticated;

-- Yes makes them a player, or a trainer (the owner only). No is kept, so the
-- asker is told rather than shown the first-time form again.
create or replace function public.answer_join_request(p_academy uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r join_requests;
begin
  if not public.is_staff(p_academy) then raise exception 'not staff'; end if;
  select * into r from join_requests where academy_id = p_academy and user_id = p_user and declined_at is null;
  if not found then raise exception 'no such request'; end if;
  if r.role = 'trainer' and public.academy_role(p_academy) is distinct from 'owner' then
    raise exception 'only the owner lets trainers in';
  end if;
  if p_approve then
    insert into academy_members (academy_id, user_id, role) values (p_academy, p_user, r.role)
    on conflict (academy_id, user_id) do update
      set role = case when excluded.role = 'trainer' and academy_members.role = 'player' then 'trainer' else academy_members.role end;
    if r.role = 'player' then
      insert into profiles (id, display_name, signed_up_by) values (p_user, r.name, r.as_who)
      on conflict (id) do update set
        display_name = coalesce(nullif(trim(profiles.display_name), ''), excluded.display_name),
        signed_up_by = coalesce(profiles.signed_up_by, excluded.signed_up_by);
    end if;
    delete from join_requests where academy_id = p_academy and user_id = p_user;
  else
    update join_requests set declined_at = now() where academy_id = p_academy and user_id = p_user;
  end if;
end; $$;
revoke all on function public.answer_join_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.answer_join_request(uuid, uuid, boolean) to authenticated;

-- ------------------------------------------------------------------------
-- As 0006, but a second request from the same email within the hour (a typo
-- fixed) replaces the first instead of being dropped.
create or replace function public.request_academy(
  p_name text, p_email text, p_academy_name text, p_slug text, p_city text,
  p_players text, p_trainers text, p_content text, p_message text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  recent uuid;
begin
  select id into recent from academy_requests
   where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour' and status = 'new'
   order by created_at desc limit 1;
  if recent is not null then
    update academy_requests set
      name = trim(p_name), academy_name = trim(p_academy_name), slug = nullif(lower(trim(p_slug)), ''),
      city = nullif(trim(p_city), ''), players = nullif(p_players, ''), trainers = nullif(p_trainers, ''),
      content = nullif(p_content, ''), message = nullif(trim(p_message), '')
     where id = recent;
    return;
  end if;
  -- One already being handled this hour: nothing more, as before.
  if exists (select 1 from academy_requests where lower(email) = lower(trim(p_email))
             and created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into academy_requests (name, email, academy_name, slug, city, players, trainers, content, message)
  values (trim(p_name), lower(trim(p_email)), trim(p_academy_name), nullif(lower(trim(p_slug)), ''),
          nullif(trim(p_city), ''), nullif(p_players, ''), nullif(p_trainers, ''), nullif(p_content, ''),
          nullif(trim(p_message), ''));
end; $$;

-- ------------------------------------------------------------------------
drop policy if exists "moves staff clear" on session_moves;
create policy "moves staff clear" on session_moves for delete using (public.is_staff(academy_id));

-- ------------------------------------------------------------------------
-- As 0024, but only this week's and later built weeks lose the drill: past
-- weeks are what the step-ups read, and what was done.
create or replace function public.delete_drill(p_drill uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a uuid;
  emptied text;
  monday date;
begin
  select academy_id into a from drills where id = p_drill;
  if not found then return; end if;
  if not public.is_staff(a) then raise exception 'staff only'; end if;
  monday := date_trunc('week', (now() at time zone (select time_zone from academies where id = a)))::date;

  select string_agg(name, ', ' order by name) into emptied from (
    select name from library_sessions
     where academy_id = a and p_drill = any(drill_ids) and cardinality(array_remove(drill_ids, p_drill)) = 0
    union all
    select name from academy_sessions
     where academy_id = a and library_id is null and p_drill = any(drill_ids)
       and cardinality(array_remove(drill_ids, p_drill)) = 0
  ) s;
  if emptied is not null then
    raise exception 'only drill in: %', emptied using errcode = 'P0001';
  end if;

  update library_sessions set drill_ids = array_remove(drill_ids, p_drill)
   where academy_id = a and p_drill = any(drill_ids);
  update academy_sessions set drill_ids = array_remove(drill_ids, p_drill)
   where academy_id = a and library_id is null and p_drill = any(drill_ids);

  update player_week_sessions s
     set drill_ids = array(select d from unnest(s.drill_ids) with ordinality u(d, i)
                            where d <> p_drill order by i),
         steps = array(select s.steps[i::int] from unnest(s.drill_ids) with ordinality u(d, i)
                        where d <> p_drill and i <= cardinality(s.steps) order by i),
         changes = array(select s.changes[i::int] from unnest(s.drill_ids) with ordinality u(d, i)
                          where d <> p_drill and i <= cardinality(s.changes) order by i)
   where academy_id = a and week_of >= monday and p_drill = any(drill_ids);
  delete from player_week_sessions where academy_id = a and week_of >= monday and cardinality(drill_ids) = 0;

  delete from drills where id = p_drill;
end; $$;
revoke all on function public.delete_drill(uuid) from public, anon;
grant execute on function public.delete_drill(uuid) to authenticated;

-- ------------------------------------------------------------------------
-- The admin panel (0026), corrected:
--   overview   weeks in one pass; AI week builds only; the academy a session
--              was for, not every academy the player is in; declined
--              requests aren't waiting.
--   academies  approved but not yet claimed, apart from setting up.
--   academy    as above, and AI week builds only.
--   users      paged and searched in the database.
--   user       the last session done, and done sessions only in the list.

create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d7  timestamptz := now() - interval '7 days';
  d30 timestamptz := now() - interval '30 days';
  first_week timestamptz := date_trunc('week', now()) - interval '11 weeks';
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;

  return jsonb_build_object(
    'users',        (select count(*) from auth.users),
    'users_7d',     (select count(*) from auth.users where created_at >= d7),
    'users_30d',    (select count(*) from auth.users where created_at >= d30),
    'academies',    (select count(*) from academies),
    'trainers',     (select count(distinct user_id) from academy_members where role in ('owner', 'trainer')),
    'players',      (select count(distinct user_id) from academy_members where role = 'player'),
    'no_academy',   (select count(*) from auth.users u
                      where not exists (select 1 from academy_members m where m.user_id = u.id)),
    'sessions_all', (select count(*) from workouts w where w.status = 'completed'),
    'sessions_7d',  (select count(*) from workouts w where w.status = 'completed' and coalesce(w.completed_at, w.created_at) >= d7),
    'sessions_30d', (select count(*) from workouts w where w.status = 'completed' and coalesce(w.completed_at, w.created_at) >= d30),
    'minutes_7d',   (select coalesce(round(sum(coalesce(w.actual_minutes, w.planned_minutes))), 0)
                       from workouts w where w.status = 'completed' and coalesce(w.completed_at, w.created_at) >= d7),
    'active_7d',    (select count(distinct w.user_id) from workouts w where w.status = 'completed' and coalesce(w.completed_at, w.created_at) >= d7),
    'active_30d',   (select count(distinct w.user_id) from workouts w where w.status = 'completed' and coalesce(w.completed_at, w.created_at) >= d30),
    'requests_open', (select count(*) from academy_requests where status in ('new', 'contacted')),
    'join_waiting', (select count(*) from join_requests where declined_at is null),
    'ai_30d',       (select jsonb_build_object('calls', count(*), 'failed', count(*) filter (where not ok),
                                               'tokens', coalesce(sum(input_tokens + output_tokens), 0))
                       from ai_usage where created_at >= d30 and kind = 'week'),
    'weeks', (
      select jsonb_agg(jsonb_build_object('week', to_char(g.wk, 'YYYY-MM-DD'),
        'signups', coalesce(su.n, 0), 'sessions', coalesce(se.n, 0), 'active', coalesce(se.people, 0)) order by g.wk)
      from generate_series(first_week, date_trunc('week', now()), interval '1 week') g(wk)
      left join (select date_trunc('week', created_at) wk, count(*) n from auth.users
                  where created_at >= first_week group by 1) su on su.wk = g.wk
      left join (select date_trunc('week', coalesce(completed_at, created_at)) wk, count(*) n, count(distinct user_id) people
                   from workouts where status = 'completed' and coalesce(completed_at, created_at) >= first_week group by 1) se on se.wk = g.wk),
    'recent', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select w.id, w.user_id, w.title, w.source, w.feel, coalesce(w.completed_at, w.created_at) as at,
               coalesce(w.actual_minutes, w.planned_minutes) as minutes,
               u.email, p.display_name as name,
               (select a.name from academies a where a.id = public.session_academy(w.source, w.source_ref)) as academy
        from workouts w join auth.users u on u.id = w.user_id left join profiles p on p.id = w.user_id
        where w.status = 'completed'
        order by coalesce(w.completed_at, w.created_at) desc limit 40) x), '[]'::jsonb),
    'signups', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select u.id, u.email, u.created_at, u.last_sign_in_at, p.display_name as name,
               (select jsonb_agg(jsonb_build_object('slug', a.slug, 'name', a.name, 'role', m.role))
                  from academy_members m join academies a on a.id = m.academy_id where m.user_id = u.id) as academies
        from auth.users u left join profiles p on p.id = u.id
        order by u.created_at desc limit 15) x), '[]'::jsonb)
  );
end; $$;

create or replace function public.admin_academies()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d7  timestamptz := now() - interval '7 days';
  d30 timestamptz := now() - interval '30 days';
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'slug', a.slug, 'name', a.name, 'city', a.city, 'created_at', a.created_at,
      'library_access', a.library_access, 'listed', a.listed,
      'set_up', (a.setup ? 'done'),
      'unclaimed', exists (select 1 from academy_requests r where r.academy_id = a.id and r.claimed_at is null)
                   and not exists (select 1 from academy_members m where m.academy_id = a.id and m.role = 'owner'),
      'owner', (select jsonb_build_object('id', u.id, 'email', u.email, 'name', p.display_name)
                  from academy_members m join auth.users u on u.id = m.user_id
                  left join profiles p on p.id = m.user_id
                  where m.academy_id = a.id and m.role = 'owner' order by m.joined_at limit 1),
      'trainers', (select count(*) from academy_members m where m.academy_id = a.id and m.role in ('owner', 'trainer')),
      'players',  (select count(*) from academy_members m where m.academy_id = a.id and m.role = 'player'),
      'active_7d', act.active_7d, 'sessions_7d', act.sessions_7d, 'sessions_30d', act.sessions_30d, 'last_done', act.last_done,
      'programs', (select count(*) from academy_programs x where x.academy_id = a.id),
      'groups',   (select count(*) from groups g where g.academy_id = a.id and not g.archived),
      'drills',   (select count(*) from drills d where d.academy_id = a.id),
      'notes_30d', (select count(*) from notes n where n.academy_id = a.id and n.created_at >= d30),
      'waiting',  (select count(*) from join_requests j where j.academy_id = a.id and j.declined_at is null),
      'ai_30d',   (select count(*) from ai_usage x where x.academy_id = a.id and x.created_at >= d30 and x.kind = 'week'))
      order by a.created_at)
    from academies a
    cross join lateral (
      select count(distinct w.user_id) filter (where w.at >= d7) as active_7d,
             count(*) filter (where w.at >= d7) as sessions_7d,
             count(*) filter (where w.at >= d30) as sessions_30d,
             max(w.at) as last_done
      from (select ww.user_id, coalesce(ww.completed_at, ww.created_at) as at, ww.source, ww.source_ref
              from workouts ww
              join academy_members m on m.user_id = ww.user_id and m.academy_id = a.id and m.role = 'player'
             where ww.status = 'completed') w
      where not public.elsewhere(a.id, w.source, w.source_ref)) act), '[]'::jsonb);
end; $$;

create or replace function public.admin_academy(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d7  timestamptz := now() - interval '7 days';
  d30 timestamptz := now() - interval '30 days';
  a   academies;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  select * into a from academies where id = p_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'id', a.id, 'slug', a.slug, 'name', a.name, 'city', a.city, 'time_zone', a.time_zone,
    'created_at', a.created_at, 'library_access', a.library_access, 'listed', a.listed,
    'set_up', (a.setup ? 'done'),
    'unclaimed', exists (select 1 from academy_requests r where r.academy_id = a.id and r.claimed_at is null)
                 and not exists (select 1 from academy_members m where m.academy_id = a.id and m.role = 'owner'),
    'billing_mode', a.billing_mode, 'price_cents', a.price_cents,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.user_id, 'role', m.role, 'joined_at', m.joined_at, 'email', u.email,
        'name', p.display_name, 'last_sign_in_at', u.last_sign_in_at,
        'sessions_7d', act.s7, 'sessions_30d', act.s30, 'last_done', act.last_done,
        'groups', (select string_agg(g.name, ', ' order by g.name) from group_members gm
                     join groups g on g.id = gm.group_id where gm.user_id = m.user_id and g.academy_id = a.id and not g.archived))
        order by case m.role when 'owner' then 0 when 'trainer' then 1 else 2 end, coalesce(p.display_name, u.email))
      from academy_members m join auth.users u on u.id = m.user_id left join profiles p on p.id = m.user_id
      cross join lateral (
        select count(*) filter (where coalesce(w.completed_at, w.created_at) >= d7) as s7,
               count(*) filter (where coalesce(w.completed_at, w.created_at) >= d30) as s30,
               max(coalesce(w.completed_at, w.created_at)) as last_done
          from workouts w where w.user_id = m.user_id and w.status = 'completed'
           and not public.elsewhere(a.id, w.source, w.source_ref)) act
      where m.academy_id = a.id), '[]'::jsonb),
    'programs', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'weeks', x.weeks, 'created_at', x.created_at,
        'sessions', (select count(*) from academy_sessions s where s.program_id = x.id)) order by x.created_at)
      from academy_programs x where x.academy_id = a.id), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'program', pr.name, 'starts_on', g.starts_on,
        'members', (select count(*) from group_members gm where gm.group_id = g.id)) order by g.name)
      from groups g left join academy_programs pr on pr.id = g.program_id
      where g.academy_id = a.id and not g.archived), '[]'::jsonb),
    'waiting', coalesce((
      select jsonb_agg(jsonb_build_object('id', j.user_id, 'name', j.name, 'email', u.email, 'created_at', j.created_at, 'role', j.role)
        order by j.created_at)
      from join_requests j join auth.users u on u.id = j.user_id where j.academy_id = a.id and j.declined_at is null), '[]'::jsonb),
    'drills', (select count(*) from drills d where d.academy_id = a.id),
    'notes_30d', (select count(*) from notes n where n.academy_id = a.id and n.created_at >= d30),
    'ai_30d', (select jsonb_build_object('calls', count(*), 'failed', count(*) filter (where not ok),
                                         'tokens', coalesce(sum(input_tokens + output_tokens), 0))
                 from ai_usage x where x.academy_id = a.id and x.created_at >= d30 and x.kind = 'week'),
    'recent', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select w.id, w.user_id, w.title, w.source, w.feel, coalesce(w.completed_at, w.created_at) as at,
               coalesce(w.actual_minutes, w.planned_minutes) as minutes, coalesce(p.display_name, u.email) as who
        from workouts w
        join academy_members m on m.user_id = w.user_id and m.academy_id = a.id and m.role = 'player'
        join auth.users u on u.id = w.user_id left join profiles p on p.id = w.user_id
        where w.status = 'completed' and not public.elsewhere(a.id, w.source, w.source_ref)
        order by coalesce(w.completed_at, w.created_at) desc limit 30) x), '[]'::jsonb)
  );
end; $$;

-- Paged: p_filter is all | players | staff | none | quiet (players with
-- nothing done in 30 days). Counts for every filter come back with the page.
drop function if exists public.admin_users();
create or replace function public.admin_users(p_query text default null, p_filter text default 'all',
                                              p_limit int default 100, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d30 timestamptz := now() - interval '30 days';
  q text := nullif(lower(trim(coalesce(p_query, ''))), '');
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;

  return (
    with base as (
      select u.id, u.email, u.created_at, u.last_sign_in_at, p.display_name as name,
             exists (select 1 from academy_members m where m.user_id = u.id and m.role = 'player') as is_player,
             exists (select 1 from academy_members m where m.user_id = u.id and m.role in ('owner', 'trainer')) as is_staff,
             exists (select 1 from academy_members m where m.user_id = u.id) as in_any,
             exists (select 1 from workouts w where w.user_id = u.id and w.status = 'completed'
                       and coalesce(w.completed_at, w.created_at) >= d30) as recent
        from auth.users u left join profiles p on p.id = u.id
       where q is null or lower(u.email) like '%' || q || '%' or lower(coalesce(p.display_name, '')) like '%' || q || '%'
          or exists (select 1 from academy_members m join academies a on a.id = m.academy_id
                      where m.user_id = u.id and (lower(a.name) like '%' || q || '%' or a.slug like '%' || q || '%'))
    ),
    picked as (
      select * from base
       where case coalesce(p_filter, 'all')
               when 'players' then is_player
               when 'staff' then is_staff
               when 'none' then not in_any
               when 'quiet' then is_player and not recent
               else true end
    )
    select jsonb_build_object(
      'total', (select count(*) from picked),
      'counts', jsonb_build_object(
        'all', (select count(*) from base),
        'players', (select count(*) from base where is_player),
        'staff', (select count(*) from base where is_staff),
        'none', (select count(*) from base where not in_any),
        'quiet', (select count(*) from base where is_player and not recent)),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id, 'email', x.email, 'name', x.name, 'created_at', x.created_at, 'last_sign_in_at', x.last_sign_in_at,
          'admin', exists (select 1 from admins ad where ad.user_id = x.id),
          'academies', (select jsonb_agg(jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name, 'role', m.role)
                                         order by m.joined_at)
                          from academy_members m join academies a on a.id = m.academy_id where m.user_id = x.id),
          'sessions_all', (select count(*) from workouts w where w.user_id = x.id and w.status = 'completed'),
          'sessions_30d', (select count(*) from workouts w where w.user_id = x.id and w.status = 'completed'
                             and coalesce(w.completed_at, w.created_at) >= d30),
          'last_done',    (select max(coalesce(w.completed_at, w.created_at)) from workouts w
                             where w.user_id = x.id and w.status = 'completed'))
          order by x.created_at desc)
        from (select * from picked order by created_at desc
               limit greatest(1, least(coalesce(p_limit, 100), 500)) offset greatest(0, coalesce(p_offset, 0))) x), '[]'::jsonb)
    )
  );
end; $$;

create or replace function public.admin_user(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  u auth.users;
  p profiles;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  select * into u from auth.users where id = p_id;
  if not found then return null; end if;
  select * into p from profiles where id = p_id;

  return jsonb_build_object(
    'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'confirmed_at', u.email_confirmed_at,
    'admin', exists (select 1 from admins ad where ad.user_id = u.id),
    'profile', case when p.id is null then null else jsonb_build_object(
      'name', p.display_name, 'positions', p.positions, 'age_band', p.age_band, 'level', p.level,
      'dominant_foot', p.dominant_foot, 'club', p.club, 'region', p.region,
      'signed_up_by', p.signed_up_by,
      'speed_tests', case jsonb_typeof(p.speed_tests) when 'array' then jsonb_array_length(p.speed_tests) else 0 end) end,
    'academies', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name, 'role', m.role, 'joined_at', m.joined_at)
        order by m.joined_at)
      from academy_members m join academies a on a.id = m.academy_id where m.user_id = u.id), '[]'::jsonb),
    'asking', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name, 'created_at', j.created_at,
                                          'role', j.role, 'declined', j.declined_at is not null))
      from join_requests j join academies a on a.id = j.academy_id where j.user_id = u.id), '[]'::jsonb),
    'plan', (select jsonb_build_object('name', pl.name, 'created_at', pl.created_at,
                      'days', (select count(*) from plan_days d where d.plan_id = pl.id))
               from plans pl where pl.user_id = u.id and pl.active order by pl.created_at desc limit 1),
    'sessions_all', (select count(*) from workouts w where w.user_id = u.id and w.status = 'completed'),
    'minutes_all',  (select coalesce(round(sum(coalesce(w.actual_minutes, w.planned_minutes))), 0)
                       from workouts w where w.user_id = u.id and w.status = 'completed'),
    'last_done',    (select max(coalesce(w.completed_at, w.created_at)) from workouts w
                       where w.user_id = u.id and w.status = 'completed'),
    'unfinished',   (select count(*) from workouts w where w.user_id = u.id and w.status <> 'completed'),
    'notes', (select jsonb_build_object('received', count(*), 'unread', count(*) filter (where r.seen_at is null))
                from note_recipients r where r.user_id = u.id),
    'notes_sent', (select count(*) from notes n where n.author_id = u.id),
    'workouts', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select w.id, w.title, w.source, w.status, w.feel, coalesce(w.completed_at, w.created_at) as at,
               coalesce(w.actual_minutes, w.planned_minutes) as minutes,
               coalesce(w.actual_touches, w.planned_touches) as touches,
               (select a.name from academies a where a.id = public.session_academy(w.source, w.source_ref)) as academy
        from workouts w where w.user_id = u.id and w.status = 'completed'
        order by coalesce(w.completed_at, w.created_at) desc limit 60) x), '[]'::jsonb)
  );
end; $$;

revoke all on function public.admin_overview()   from public, anon;
revoke all on function public.admin_academies()  from public, anon;
revoke all on function public.admin_academy(uuid) from public, anon;
revoke all on function public.admin_users(text, text, int, int) from public, anon;
revoke all on function public.admin_user(uuid)   from public, anon;
grant execute on function public.admin_overview()    to authenticated;
grant execute on function public.admin_academies()   to authenticated;
grant execute on function public.admin_academy(uuid) to authenticated;
grant execute on function public.admin_users(text, text, int, int) to authenticated;
grant execute on function public.admin_user(uuid)    to authenticated;
