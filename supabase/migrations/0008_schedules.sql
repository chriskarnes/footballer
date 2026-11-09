-- 0008: sessions on days that fit each player's soccer; drills tagged with
-- everything they work on.
--
-- Every player's week is different: club training on their own days, a game
-- at the weekend. The player (or a parent) says which days are taken, once;
-- the app puts the trainer's sessions on the free days. A player can move one
-- session for one week without changing the rest.
--
-- Run after 0007. Safe to run twice.

-- ------------------------------------------------------- SOCCER DAYS ---
-- Personal, not per academy: club days are the same whoever sets homework.
-- Days are 0 = Monday … 6 = Sunday, as everywhere else in the app.
create table if not exists player_schedules (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  club_days  smallint[] not null default '{}',
  game_day   smallint check (game_day is null or game_day between 0 and 6),
  updated_at timestamptz not null default now(),
  constraint club_days_valid check (club_days <@ array[0,1,2,3,4,5,6]::smallint[])
);

-- Staff of any academy the player belongs to.
create or replace function public.trains(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from academy_members m where m.user_id = p_user and public.is_staff(m.academy_id));
$$;
grant execute on function public.trains(uuid) to authenticated;

alter table player_schedules enable row level security;
drop policy if exists "schedules read" on player_schedules;
create policy "schedules read" on player_schedules for select
  using (user_id = auth.uid() or public.trains(user_id));
-- The player sets it; a trainer can too, when a parent tells them at practice.
drop policy if exists "schedules write" on player_schedules;
create policy "schedules write" on player_schedules for all
  using (user_id = auth.uid() or public.trains(user_id))
  with check (user_id = auth.uid() or public.trains(user_id));

-- ---------------------------------------------------- ONE-WEEK MOVES ---
-- "Can't do Wednesday": this week's item, on another day. item_key is the
-- week item's key (s:<session id> or a:<addon id>); week_of is its Monday.
create table if not exists session_moves (
  user_id    uuid not null references auth.users(id) on delete cascade,
  academy_id uuid not null references academies(id) on delete cascade,
  week_of    date not null,
  item_key   text not null check (char_length(item_key) <= 80),
  weekday    smallint not null check (weekday between 0 and 6),
  created_at timestamptz not null default now(),
  primary key (user_id, week_of, item_key)
);
create index if not exists session_moves_academy_idx on session_moves (academy_id, week_of);

alter table session_moves enable row level security;
drop policy if exists "moves read" on session_moves;
create policy "moves read" on session_moves for select
  using (user_id = auth.uid() or public.is_staff(academy_id));
drop policy if exists "moves write" on session_moves;
create policy "moves write" on session_moves for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(academy_id));

-- ------------------------------------------------------- DRILL TAGS ---
-- A drill can work on more than one thing ("Weak Foot" and "Passing"). The
-- tags live in focus_areas; focus stays as the first of them, which is what
-- the runner and suggestions read as the drill's main focus.
alter table drills add column if not exists focus_areas text[] not null default '{}';
update drills set focus_areas = array[focus] where focus is not null and focus_areas = '{}';
alter table drills drop constraint if exists drills_focus_areas_check;
alter table drills add constraint drills_focus_areas_check check (cardinality(focus_areas) <= 15);

-- ------------------------------------------------------- CALENDAR FEED ---
-- As 0007, plus the player's soccer days and moves, so the feed puts each
-- session on the day the app shows.
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
    'schedules', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'club_days', s.club_days, 'game_day', s.game_day))
      from player_schedules s where s.user_id = u), '[]'::jsonb),
    'moves', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'week_of', m.week_of, 'item_key', m.item_key, 'weekday', m.weekday))
      from session_moves m where m.academy_id = a and m.user_id = u and m.week_of > current_date - 21), '[]'::jsonb)
  );
end; $$;
revoke all on function public.calendar_academy(text, text) from public;
grant execute on function public.calendar_academy(text, text) to anon, authenticated;
