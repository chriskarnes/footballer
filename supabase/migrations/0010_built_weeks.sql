-- 0010: weeks built for one player. Training targets (how many sessions,
-- how long), the few things they need to work on, and the sessions built
-- from those. A built week replaces the player's program for that week.
--
-- Run after 0009. Safe to run twice.

-- ------------------------------------------------------- TARGETS ---
-- Set by the trainer. The academy's default covers every player without a
-- row of their own.
create table if not exists academy_plan_defaults (
  academy_id uuid primary key references academies(id) on delete cascade,
  sessions   smallint not null default 3 check (sessions between 1 and 7),
  minutes    smallint not null default 20 check (minutes between 5 and 90),
  updated_at timestamptz not null default now()
);

create table if not exists player_plans (
  academy_id uuid not null references academies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- null: the academy default.
  sessions   smallint check (sessions is null or sessions between 1 and 7),
  minutes    smallint check (minutes is null or minutes between 5 and 90),
  -- What they need to work on: drill tags, at most three.
  focus      text[] not null default '{}' check (cardinality(focus) <= 3),
  -- Phase 3: the week is built and published each Sunday without the trainer.
  autopilot  boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (academy_id, user_id)
);

-- ---------------------------------------------------- BUILT WEEKS ---
-- One row per session of one player's week. week_of is the Monday. While a
-- player has any rows for a week, those are their week, not their program.
create table if not exists player_week_sessions (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  week_of    date not null,
  position   smallint not null default 0,
  name       text not null check (char_length(name) between 1 and 60),
  drill_ids  uuid[] not null default '{}',
  weekday    smallint not null check (weekday between 0 and 6),
  -- How it was made: rules, ai, or by hand. For the usage log later.
  made_by    text not null default 'rules' check (made_by in ('rules', 'ai', 'trainer')),
  created_at timestamptz not null default now()
);
create index if not exists player_week_sessions_idx on player_week_sessions (academy_id, user_id, week_of);

-- --------------------------------------------------------------- RLS ---
alter table academy_plan_defaults enable row level security;
drop policy if exists "plan defaults read" on academy_plan_defaults;
create policy "plan defaults read" on academy_plan_defaults for select using (public.is_member(academy_id));
drop policy if exists "plan defaults write" on academy_plan_defaults;
create policy "plan defaults write" on academy_plan_defaults for all
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

alter table player_plans enable row level security;
drop policy if exists "player plans read" on player_plans;
create policy "player plans read" on player_plans for select
  using (user_id = auth.uid() or public.is_staff(academy_id));
drop policy if exists "player plans write" on player_plans;
create policy "player plans write" on player_plans for all
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

alter table player_week_sessions enable row level security;
drop policy if exists "week sessions read" on player_week_sessions;
create policy "week sessions read" on player_week_sessions for select
  using (user_id = auth.uid() or public.is_staff(academy_id));
drop policy if exists "week sessions write" on player_week_sessions;
create policy "week sessions write" on player_week_sessions for all
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id)
    and exists (select 1 from academy_members m where m.academy_id = player_week_sessions.academy_id and m.user_id = player_week_sessions.user_id));

-- ------------------------------------------------------- CALENDAR FEED ---
-- As 0008, plus built weeks.
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
      from session_moves m where m.academy_id = a and m.user_id = u and m.week_of > current_date - 21), '[]'::jsonb),
    'custom', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'week_of', c.week_of,
      'position', c.position, 'name', c.name, 'drill_ids', c.drill_ids, 'weekday', c.weekday))
      from player_week_sessions c where c.academy_id = a and c.user_id = u and c.week_of > current_date - 21), '[]'::jsonb)
  );
end; $$;
revoke all on function public.calendar_academy(text, text) from public;
grant execute on function public.calendar_academy(text, text) to anon, authenticated;
