-- 0021: a player's week of soccer, as four kinds of day.
--
-- A day is off, a day with their trainer, team practice, or a game. Games
-- were one day a week at most (game_day); a tournament weekend is two, and
-- some kids play midweek too. Days with their trainer in person are new:
-- the at-home sessions keep off them, as they keep off practice.
--
--   game_days     any number of game days. game_day stays, written as the
--                 first of them, so anything still reading it keeps working.
--   trainer_days  days they see their trainer in person.
--
-- Days are 0 = Monday … 6 = Sunday, as everywhere else in the app.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor after 0020.
-- Safe to run twice.

alter table player_schedules add column if not exists game_days smallint[] not null default '{}';
alter table player_schedules add column if not exists trainer_days smallint[] not null default '{}';

alter table player_schedules drop constraint if exists game_days_valid;
alter table player_schedules add constraint game_days_valid check (game_days <@ array[0,1,2,3,4,5,6]::smallint[]);
alter table player_schedules drop constraint if exists trainer_days_valid;
alter table player_schedules add constraint trainer_days_valid check (trainer_days <@ array[0,1,2,3,4,5,6]::smallint[]);

-- Everyone's one game day so far, as the first of their game days.
update player_schedules set game_days = array[game_day]
  where game_day is not null and game_days = '{}';

-- ------------------------------------------------------- CALENDAR FEED ---
-- As 0010, with each schedule row whole, so the feed places sessions around
-- every game and trainer day.
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
      from addons x where x.academy_id = a and x.user_id = u and x.week_of > current_date - 21), '[]'::jsonb),
    'schedules', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'club_days', s.club_days, 'game_day', s.game_day,
      'game_days', s.game_days, 'trainer_days', s.trainer_days))
      from player_schedules s where s.user_id = u), '[]'::jsonb),
    'moves', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'week_of', m.week_of, 'item_key', m.item_key, 'weekday', m.weekday))
      from session_moves m where m.academy_id = a and m.user_id = u and m.week_of > current_date - 21), '[]'::jsonb),
    'custom', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'week_of', c.week_of,
      'position', c.position, 'name', c.name, 'drill_ids', c.drill_ids, 'weekday', c.weekday))
      from player_week_sessions c where c.academy_id = a and c.user_id = u and c.week_of > current_date - 21), '[]'::jsonb)
  );
end; $$;
revoke all on function public.calendar_academy(text, text) from public;
grant execute on function public.calendar_academy(text, text) to anon, authenticated;
