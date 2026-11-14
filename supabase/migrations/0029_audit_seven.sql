-- 0029: the seventh audit's database side.
--
--   rotate_invite        Only the owner makes a new trainer link. Someone in
--                        no academy at all got past the old check (a missing
--                        role compared as unknown, not as "not the owner").
--   session_owners       Which academy each session, extra and drill belongs
--                        to, kept after it's deleted: a finished session still
--                        counts for the academy it was done for.
--   request_academy      A cap on requests an hour; a fix within the hour only
--                        from whoever sent the first.
--   join requests        The trainer link doesn't turn a pending player request
--                        into a trainer one, and "ask to join" doesn't turn a
--                        trainer request into a player one.
--   size checks          Photos, logos and session text within reason.
--   admin                Every AI call counted, by kind, and this month's
--                        against the limit.
--
-- Safe to run more than once.

-- ------------------------------------------------------------------------
create or replace function public.rotate_invite(p_academy uuid, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  if p_role is null or p_role not in ('player', 'trainer') then raise exception 'bad role'; end if;
  if p_role = 'player' and not coalesce(public.is_staff(p_academy), false) then raise exception 'not staff'; end if;
  if p_role = 'trainer' and public.academy_role(p_academy) is distinct from 'owner' then raise exception 'not the owner'; end if;
  c := public.new_invite_code();
  insert into academy_invites (code, academy_id, role) values (c, p_academy, p_role)
  on conflict (academy_id, role) do update set code = excluded.code, created_at = now();
  return c;
end; $$;
revoke all on function public.rotate_invite(uuid, text) from public, anon;
grant execute on function public.rotate_invite(uuid, text) to authenticated;

-- ------------------------------------------------------------------------
-- Kept when a session, extra or drill is deleted (no foreign key on purpose).
create table if not exists session_owners (
  ref        uuid primary key,
  academy_id uuid not null
);
alter table session_owners enable row level security;
revoke all on session_owners from anon, authenticated;

insert into session_owners (ref, academy_id)
  select id, academy_id from academy_sessions
  union all select id, academy_id from player_week_sessions
  union all select id, academy_id from addons
  union all select id, academy_id from drills
on conflict (ref) do nothing;

create or replace function public.remember_session_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into session_owners (ref, academy_id) values (new.id, new.academy_id) on conflict (ref) do nothing;
  return new;
end; $$;
revoke all on function public.remember_session_owner() from public, anon, authenticated;

drop trigger if exists remember_owner on academy_sessions;
create trigger remember_owner after insert on academy_sessions for each row execute function public.remember_session_owner();
drop trigger if exists remember_owner on player_week_sessions;
create trigger remember_owner after insert on player_week_sessions for each row execute function public.remember_session_owner();
drop trigger if exists remember_owner on addons;
create trigger remember_owner after insert on addons for each row execute function public.remember_session_owner();
drop trigger if exists remember_owner on drills;
create trigger remember_owner after insert on drills for each row execute function public.remember_session_owner();

create or replace function public.session_academy(p_source text, p_ref text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  a uuid;
begin
  if coalesce(p_source, '') not in ('academy', 'addon')
     or p_ref is null or p_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  select academy_id into a from session_owners where ref = p_ref::uuid;
  return a;
end; $$;
revoke all on function public.session_academy(text, text) from public, anon, authenticated;

-- ------------------------------------------------------------------------
-- "Get started": who sent it (a keyed hash of where from, made by the site),
-- so only they can correct it; and no more than 30 new ones an hour in all.
alter table academy_requests add column if not exists sent_from text;

drop function if exists public.request_academy(text, text, text, text, text, text, text, text, text);
create or replace function public.request_academy(
  p_name text, p_email text, p_academy_name text, p_slug text, p_city text,
  p_players text, p_trainers text, p_content text, p_message text, p_from text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  recent academy_requests;
begin
  select * into recent from academy_requests
   where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour'
   order by created_at desc limit 1;
  if found then
    -- A typo fixed by the same sender, before anyone has looked at it.
    if recent.status = 'new' and p_from is not null and recent.sent_from = p_from then
      update academy_requests set
        name = trim(p_name), academy_name = trim(p_academy_name), slug = nullif(lower(trim(p_slug)), ''),
        city = nullif(trim(p_city), ''), players = nullif(p_players, ''), trainers = nullif(p_trainers, ''),
        content = nullif(p_content, ''), message = nullif(trim(p_message), '')
       where id = recent.id;
    end if;
    return;
  end if;
  if (select count(*) from academy_requests where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many requests';
  end if;
  insert into academy_requests (name, email, academy_name, slug, city, players, trainers, content, message, sent_from)
  values (trim(p_name), lower(trim(p_email)), trim(p_academy_name), nullif(lower(trim(p_slug)), ''),
          nullif(trim(p_city), ''), nullif(p_players, ''), nullif(p_trainers, ''), nullif(p_content, ''),
          nullif(trim(p_message), ''), left(p_from, 100));
end; $$;
revoke all on function public.request_academy(text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.request_academy(text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------------------
-- As 0028, but a pending player request isn't turned into a trainer one:
-- one account is one person here, and they've asked to play.
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
    if exists (select 1 from join_requests where academy_id = inv.academy_id and user_id = auth.uid()
                 and role = 'player' and declined_at is null) then
      raise exception 'asked as a player';
    end if;
    insert into join_requests (academy_id, user_id, name, role)
    values (inv.academy_id, auth.uid(),
            left(coalesce(nullif(trim((select display_name from profiles where id = auth.uid())), ''),
                          (select email from auth.users where id = auth.uid()), 'Trainer'), 80),
            'trainer')
    on conflict (academy_id, user_id) do update
      set role = 'trainer', name = excluded.name, message = null, as_who = null, declined_at = null, created_at = now();
    return jsonb_build_object('academy_id', inv.academy_id, 'role', 'asked',
      'slug', (select slug from academies where id = inv.academy_id));
  end if;

  if existing is null then
    insert into academy_members (academy_id, user_id, role) values (inv.academy_id, auth.uid(), 'player');
    existing := 'player';
  end if;

  insert into profiles (id, display_name)
    select auth.uid(), r.name from join_requests r
     where r.academy_id = inv.academy_id and r.user_id = auth.uid() and r.role = 'player'
  on conflict (id) do update set display_name = case when public.placeholder_name(auth.uid(), profiles.display_name)
                                                     then excluded.display_name else profiles.display_name end;
  delete from join_requests where academy_id = inv.academy_id and user_id = auth.uid() and role = 'player';

  return jsonb_build_object('academy_id', inv.academy_id, 'role', existing,
    'slug', (select slug from academies where id = inv.academy_id));
end; $$;
revoke all on function public.join_academy(text) from public, anon;
grant execute on function public.join_academy(text) to authenticated;

-- As 0027, but a pending trainer request stays one ('trainer_asked').
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
  if exists (select 1 from join_requests where academy_id = a and user_id = auth.uid()
               and role = 'trainer' and declined_at is null) then
    return 'trainer_asked';
  end if;
  insert into join_requests (academy_id, user_id, name, message, as_who, role)
  values (a, auth.uid(), trim(p_name), nullif(trim(p_message), ''), who, 'player')
  on conflict (academy_id, user_id) do update
    set name = excluded.name, message = excluded.message, as_who = coalesce(excluded.as_who, join_requests.as_who),
        role = 'player', declined_at = null, created_at = now();
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

-- ------------------------------------------------------------------------
-- Within reason, checked from here on (rows from before aren't re-read).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_size') then
    alter table profiles add constraint profiles_avatar_size
      check (avatar_data is null or octet_length(avatar_data) <= 450000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'academies_logo_size') then
    alter table academies add constraint academies_logo_size
      check (logo_data is null or octet_length(logo_data) <= 720000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workouts_text_sane') then
    alter table workouts add constraint workouts_text_sane check (
      (title is null or char_length(title) <= 200) and
      (spec is null or pg_column_size(spec) <= 20000) and
      (exercise_ids is null or cardinality(exercise_ids) <= 60)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plans_intake_size') then
    alter table plans add constraint plans_intake_size
      check (intake is null or pg_column_size(intake) <= 20000) not valid;
  end if;
end $$;

-- ------------------------------------------------------------------------
-- Admin, as 0027 but counting every AI call (week builds and one-drill
-- suggestions both count against an academy's monthly limit), with this
-- month's count beside the limit.

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
    'ai_30d',       (select jsonb_build_object('calls', count(*), 'week', count(*) filter (where kind = 'week'),
                                               'suggest', count(*) filter (where kind = 'suggest'),
                                               'failed', count(*) filter (where not ok),
                                               'tokens', coalesce(sum(input_tokens + output_tokens), 0))
                       from ai_usage where created_at >= d30),
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
      'ai_30d',   (select count(*) from ai_usage x where x.academy_id = a.id and x.created_at >= d30),
      'ai_month', (select count(*) from ai_usage x where x.academy_id = a.id
                     and x.created_at >= (date_trunc('month', now() at time zone a.time_zone) at time zone a.time_zone)))
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
    'ai_30d', (select jsonb_build_object('calls', count(*) filter (where x.created_at >= d30),
                                         'week', count(*) filter (where kind = 'week' and x.created_at >= d30),
                                         'suggest', count(*) filter (where kind = 'suggest' and x.created_at >= d30),
                                         'failed', count(*) filter (where not ok and x.created_at >= d30),
                                         'tokens', coalesce(sum(input_tokens + output_tokens) filter (where x.created_at >= d30), 0),
                                         'month', count(*) filter (where x.created_at >=
                                            (date_trunc('month', now() at time zone a.time_zone) at time zone a.time_zone)))
                 from ai_usage x where x.academy_id = a.id
                   and x.created_at >= least(d30, date_trunc('month', now() at time zone a.time_zone) at time zone a.time_zone)),
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
