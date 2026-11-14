-- 0026: the platform admin panel (/admin). Read-only views across every
-- academy and every account, for the people in `admins` (0002) only.
--
--   admin_overview()        Totals, the last 12 weeks, and what's happening now.
--   admin_academies()       Every academy, with its people and how they're training.
--   admin_academy(id)       One academy: members, programs, groups, recent sessions.
--   admin_users()           Every account: who, where, how active.
--   admin_user(id)          One account: profile, academies, sessions, notes.
--
-- Each is security definer (it reads auth.users and other academies' rows,
-- which no one's own access allows) and refuses anyone not in `admins` before
-- reading anything. Nothing here writes.
--
-- Safe to run more than once.

-- A finished session's time: when it was finished, or made if that's missing.
create or replace function public.done_at(w workouts) returns timestamptz
language sql immutable as $$ select coalesce(w.completed_at, w.created_at) $$;

-- ------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d7  timestamptz := now() - interval '7 days';
  d30 timestamptz := now() - interval '30 days';
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
    'sessions_7d',  (select count(*) from workouts w where w.status = 'completed' and w.done_at >= d7),
    'sessions_30d', (select count(*) from workouts w where w.status = 'completed' and w.done_at >= d30),
    'minutes_7d',   (select coalesce(round(sum(coalesce(w.actual_minutes, w.planned_minutes))), 0)
                       from workouts w where w.status = 'completed' and w.done_at >= d7),
    'active_7d',    (select count(distinct w.user_id) from workouts w where w.status = 'completed' and w.done_at >= d7),
    'active_30d',   (select count(distinct w.user_id) from workouts w where w.status = 'completed' and w.done_at >= d30),
    'requests_open', (select count(*) from academy_requests where status in ('new', 'contacted')),
    'join_waiting', (select count(*) from join_requests),
    'ai_30d',       (select jsonb_build_object('calls', count(*), 'failed', count(*) filter (where not ok),
                                               'tokens', coalesce(sum(input_tokens + output_tokens), 0))
                       from ai_usage where created_at >= d30),
    -- Monday-to-Sunday weeks (UTC), oldest first, this week last.
    'weeks', (
      select jsonb_agg(jsonb_build_object(
        'week', to_char(wk, 'YYYY-MM-DD'),
        'signups',  (select count(*) from auth.users u where u.created_at >= wk and u.created_at < wk + interval '7 days'),
        'sessions', (select count(*) from workouts w where w.status = 'completed'
                       and w.done_at >= wk and w.done_at < wk + interval '7 days'),
        'active',   (select count(distinct w.user_id) from workouts w where w.status = 'completed'
                       and w.done_at >= wk and w.done_at < wk + interval '7 days'))
        order by wk)
      from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') wk),
    -- The last 40 finished sessions anywhere, with who and where.
    'recent', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select w.id, w.user_id, w.title, w.source, w.feel, w.done_at as at,
               coalesce(w.actual_minutes, w.planned_minutes) as minutes,
               u.email, p.display_name as name,
               (select string_agg(a.name, ', ' order by a.name) from academy_members m
                  join academies a on a.id = m.academy_id where m.user_id = w.user_id) as academies
        from workouts w join auth.users u on u.id = w.user_id left join profiles p on p.id = w.user_id
        where w.status = 'completed'
        order by w.done_at desc limit 40) x), '[]'::jsonb),
    -- The last 15 accounts made.
    'signups', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select u.id, u.email, u.created_at, u.last_sign_in_at, p.display_name as name,
               (select jsonb_agg(jsonb_build_object('slug', a.slug, 'name', a.name, 'role', m.role))
                  from academy_members m join academies a on a.id = m.academy_id where m.user_id = u.id) as academies
        from auth.users u left join profiles p on p.id = u.id
        order by u.created_at desc limit 15) x), '[]'::jsonb)
  );
end; $$;

-- ------------------------------------------------------------------------
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
      'owner', (select jsonb_build_object('id', u.id, 'email', u.email, 'name', p.display_name)
                  from academy_members m join auth.users u on u.id = m.user_id
                  left join profiles p on p.id = m.user_id
                  where m.academy_id = a.id and m.role = 'owner' order by m.joined_at limit 1),
      'trainers', (select count(*) from academy_members m where m.academy_id = a.id and m.role in ('owner', 'trainer')),
      'players',  (select count(*) from academy_members m where m.academy_id = a.id and m.role = 'player'),
      'active_7d', (select count(distinct w.user_id) from workouts w
                     join academy_members m on m.user_id = w.user_id and m.academy_id = a.id and m.role = 'player'
                     where w.status = 'completed' and w.done_at >= d7
                       and not public.elsewhere(a.id, w.source, w.source_ref)),
      'sessions_7d', (select count(*) from workouts w
                     join academy_members m on m.user_id = w.user_id and m.academy_id = a.id and m.role = 'player'
                     where w.status = 'completed' and w.done_at >= d7
                       and not public.elsewhere(a.id, w.source, w.source_ref)),
      'sessions_30d', (select count(*) from workouts w
                     join academy_members m on m.user_id = w.user_id and m.academy_id = a.id and m.role = 'player'
                     where w.status = 'completed' and w.done_at >= d30
                       and not public.elsewhere(a.id, w.source, w.source_ref)),
      'last_done', (select max(w.done_at) from workouts w
                     join academy_members m on m.user_id = w.user_id and m.academy_id = a.id and m.role = 'player'
                     where w.status = 'completed' and not public.elsewhere(a.id, w.source, w.source_ref)),
      'programs', (select count(*) from academy_programs x where x.academy_id = a.id),
      'groups',   (select count(*) from groups g where g.academy_id = a.id and not g.archived),
      'drills',   (select count(*) from drills d where d.academy_id = a.id),
      'notes_30d', (select count(*) from notes n where n.academy_id = a.id and n.created_at >= d30),
      'waiting',  (select count(*) from join_requests j where j.academy_id = a.id),
      'ai_30d',   (select count(*) from ai_usage x where x.academy_id = a.id and x.created_at >= d30))
      order by a.created_at)
    from academies a), '[]'::jsonb);
end; $$;

-- ------------------------------------------------------------------------
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
    'billing_mode', a.billing_mode, 'price_cents', a.price_cents,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.user_id, 'role', m.role, 'joined_at', m.joined_at, 'email', u.email,
        'name', p.display_name, 'last_sign_in_at', u.last_sign_in_at,
        'sessions_7d',  (select count(*) from workouts w where w.user_id = m.user_id and w.status = 'completed'
                           and w.done_at >= d7 and not public.elsewhere(a.id, w.source, w.source_ref)),
        'sessions_30d', (select count(*) from workouts w where w.user_id = m.user_id and w.status = 'completed'
                           and w.done_at >= d30 and not public.elsewhere(a.id, w.source, w.source_ref)),
        'last_done',    (select max(w.done_at) from workouts w where w.user_id = m.user_id and w.status = 'completed'
                           and not public.elsewhere(a.id, w.source, w.source_ref)),
        'groups', (select string_agg(g.name, ', ' order by g.name) from group_members gm
                     join groups g on g.id = gm.group_id where gm.user_id = m.user_id and g.academy_id = a.id and not g.archived))
        order by case m.role when 'owner' then 0 when 'trainer' then 1 else 2 end, coalesce(p.display_name, u.email))
      from academy_members m join auth.users u on u.id = m.user_id left join profiles p on p.id = m.user_id
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
      select jsonb_agg(jsonb_build_object('id', j.user_id, 'name', j.name, 'email', u.email, 'created_at', j.created_at)
        order by j.created_at)
      from join_requests j join auth.users u on u.id = j.user_id where j.academy_id = a.id), '[]'::jsonb),
    'drills', (select count(*) from drills d where d.academy_id = a.id),
    'notes_30d', (select count(*) from notes n where n.academy_id = a.id and n.created_at >= d30),
    'ai_30d', (select jsonb_build_object('calls', count(*), 'failed', count(*) filter (where not ok),
                                         'tokens', coalesce(sum(input_tokens + output_tokens), 0))
                 from ai_usage x where x.academy_id = a.id and x.created_at >= d30),
    -- The last 30 sessions its players finished for it (or on their own).
    'recent', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select w.id, w.user_id, w.title, w.source, w.feel, w.done_at as at,
               coalesce(w.actual_minutes, w.planned_minutes) as minutes, coalesce(p.display_name, u.email) as who
        from workouts w
        join academy_members m on m.user_id = w.user_id and m.academy_id = a.id and m.role = 'player'
        join auth.users u on u.id = w.user_id left join profiles p on p.id = w.user_id
        where w.status = 'completed' and not public.elsewhere(a.id, w.source, w.source_ref)
        order by w.done_at desc limit 30) x), '[]'::jsonb)
  );
end; $$;

-- ------------------------------------------------------------------------
create or replace function public.admin_users()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d30 timestamptz := now() - interval '30 days';
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id, 'email', u.email, 'name', p.display_name,
      'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
      'admin', exists (select 1 from admins ad where ad.user_id = u.id),
      'academies', (select jsonb_agg(jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name, 'role', m.role)
                                     order by m.joined_at)
                      from academy_members m join academies a on a.id = m.academy_id where m.user_id = u.id),
      'sessions_all', (select count(*) from workouts w where w.user_id = u.id and w.status = 'completed'),
      'sessions_30d', (select count(*) from workouts w where w.user_id = u.id and w.status = 'completed' and w.done_at >= d30),
      'last_done',    (select max(w.done_at) from workouts w where w.user_id = u.id and w.status = 'completed'))
      order by u.created_at desc)
    from auth.users u left join profiles p on p.id = u.id), '[]'::jsonb);
end; $$;

-- ------------------------------------------------------------------------
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
      'signed_up_by', p.signed_up_by, 'speed_tests', case jsonb_typeof(p.speed_tests) when 'array' then jsonb_array_length(p.speed_tests) else 0 end) end,
    'academies', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name, 'role', m.role, 'joined_at', m.joined_at)
        order by m.joined_at)
      from academy_members m join academies a on a.id = m.academy_id where m.user_id = u.id), '[]'::jsonb),
    'asking', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name, 'created_at', j.created_at))
      from join_requests j join academies a on a.id = j.academy_id where j.user_id = u.id), '[]'::jsonb),
    'plan', (select jsonb_build_object('name', pl.name, 'created_at', pl.created_at,
                      'days', (select count(*) from plan_days d where d.plan_id = pl.id))
               from plans pl where pl.user_id = u.id and pl.active order by pl.created_at desc limit 1),
    'sessions_all', (select count(*) from workouts w where w.user_id = u.id and w.status = 'completed'),
    'minutes_all',  (select coalesce(round(sum(coalesce(w.actual_minutes, w.planned_minutes))), 0)
                       from workouts w where w.user_id = u.id and w.status = 'completed'),
    'notes', (select jsonb_build_object('received', count(*), 'unread', count(*) filter (where r.seen_at is null))
                from note_recipients r where r.user_id = u.id),
    'notes_sent', (select count(*) from notes n where n.author_id = u.id),
    'workouts', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select w.id, w.title, w.source, w.status, w.feel, w.done_at as at,
               coalesce(w.actual_minutes, w.planned_minutes) as minutes,
               coalesce(w.actual_touches, w.planned_touches) as touches
        from workouts w where w.user_id = u.id
        order by w.done_at desc limit 60) x), '[]'::jsonb)
  );
end; $$;

-- Signed-in callers only; each refuses anyone not in `admins`.
revoke all on function public.admin_overview()   from public, anon;
revoke all on function public.admin_academies()  from public, anon;
revoke all on function public.admin_academy(uuid) from public, anon;
revoke all on function public.admin_users()      from public, anon;
revoke all on function public.admin_user(uuid)   from public, anon;
grant execute on function public.admin_overview()    to authenticated;
grant execute on function public.admin_academies()   to authenticated;
grant execute on function public.admin_academy(uuid) to authenticated;
grant execute on function public.admin_users()       to authenticated;
grant execute on function public.admin_user(uuid)    to authenticated;
