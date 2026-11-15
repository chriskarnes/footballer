-- 0034: the tenth audit's database side.
--
--   request_academy     "Get started" is limited per sender's address, kept
--                       here rather than in the server's memory (which each
--                       server instance had its own copy of, and lost on a
--                       restart). The only lasting limit was 30 an hour for
--                       everyone together, so one script could use them up
--                       and shut the form for every real trainer. Now: 3 an
--                       hour and 10 a day from one address; the everyone
--                       ceiling stays as a backstop, at 300 an hour.
--   calendar_academy    Hands back when the player was added to each group,
--                       so the calendar puts a first, part-week's sessions
--                       on the same days the app does.
--
-- Run after the app that sends p_addr is deployed (it falls back to the
-- 0033 function until this runs).
--
-- Safe to run more than once.

-- ------------------------------------------------------------------------
-- Who sent it, by address alone: a keyed hash from the server, never the
-- address itself. (sent_from, from 0029, also takes in the browser, which a
-- script changes at will: right for "is this the same person fixing a
-- typo", no use as a limit.)
alter table academy_requests add column if not exists sent_addr text;
create index if not exists academy_requests_addr_idx on academy_requests (sent_addr, created_at);

drop function if exists public.request_academy(text, text, text, text, text, text, text, text, text, text);
create or replace function public.request_academy(
  p_name text, p_email text, p_academy_name text, p_slug text, p_city text,
  p_players text, p_trainers text, p_content text, p_message text, p_from text default null,
  p_addr text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  mine academy_requests;
  addr text := nullif(left(p_addr, 100), '');
begin
  if p_from is not null then
    -- The same sender again within the hour. Not yet looked at, it's a typo
    -- being fixed; once an admin has, it's something new to say (0033).
    select * into mine from academy_requests
     where lower(email) = lower(trim(p_email)) and sent_from = left(p_from, 100)
       and created_at > now() - interval '1 hour'
     order by created_at desc limit 1;
    if found and mine.status = 'new' then
      update academy_requests set
        name = trim(p_name), academy_name = trim(p_academy_name), slug = nullif(lower(trim(p_slug)), ''),
        city = nullif(trim(p_city), ''), players = nullif(p_players, ''), trainers = nullif(p_trainers, ''),
        content = nullif(p_content, ''), message = nullif(trim(p_message), '')
       where id = mine.id;
      return;
    end if;
  elsif exists (select 1 from academy_requests
                 where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour') then
    -- No telling who sent it: once an hour for an email is enough.
    return;
  end if;
  -- One address: a few an hour, a handful a day. Its own message, so the
  -- form can say it's them, not that everyone is busy.
  if addr is not null and (
       (select count(*) from academy_requests where sent_addr = addr and created_at > now() - interval '1 hour') >= 3
    or (select count(*) from academy_requests where sent_addr = addr and created_at > now() - interval '1 day') >= 10) then
    raise exception 'too many from here';
  end if;
  -- Everyone together: a backstop against a flood from many addresses, set
  -- well above any real hour so one sender can't spend it for the rest.
  if (select count(*) from academy_requests where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'too many requests';
  end if;
  insert into academy_requests (name, email, academy_name, slug, city, players, trainers, content, message, sent_from, sent_addr)
  values (trim(p_name), lower(trim(p_email)), trim(p_academy_name), nullif(lower(trim(p_slug)), ''),
          nullif(trim(p_city), ''), nullif(p_players, ''), nullif(p_trainers, ''), nullif(p_content, ''),
          nullif(trim(p_message), ''), left(p_from, 100), addr);
end; $$;
revoke all on function public.request_academy(text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_academy(text, text, text, text, text, text, text, text, text, text, text) to service_role;

-- ------------------------------------------------------------------------
-- As 0027, with each membership's added_at.
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
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('group_id', gm.group_id, 'user_id', gm.user_id, 'added_at', gm.added_at))
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
