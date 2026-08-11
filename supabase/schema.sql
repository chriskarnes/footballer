-- ============================================================================
-- FORGE — schema
-- Library tables are public read. Everything user-owned is protected by RLS.
-- Run this in the Supabase SQL editor, then `npm run seed`.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------- LIBRARY ---
create table if not exists programs (
  id            text primary key,
  name          text not null,
  category      text not null,              -- Technical | Physical | Finishing & Crossing
  kid_name      text,
  level         text,
  goal          text,
  graduation    text,
  total_minutes int,
  touches       int,
  created_at    timestamptz default now()
);

create table if not exists sessions (
  id             text primary key,
  program_id     text references programs(id) on delete cascade,
  name           text not null,
  session_number int,
  total_minutes  numeric,
  touches        int,
  hits_touch_goal boolean default false,
  focus_areas    text[] default '{}',
  can_do_at_home boolean default false,
  equipment      text[] default '{}',
  sort_order     int
);

create table if not exists exercises (
  id              text primary key,
  session_id      text references sessions(id) on delete cascade,
  program_id      text references programs(id) on delete cascade,
  name            text not null,
  exercise_order  int,
  sets            text,
  reps_time       text,
  rest            text,
  total_seconds   int,
  work_seconds    int,
  total_minutes   numeric,
  touches         int,
  touches_per_min numeric,
  primary_focus   text,
  focus_areas     text[] default '{}',
  equipment       text[] default '{}',
  intensity       text,
  space_required  text,
  can_do_at_home  boolean default false,
  gym_required    boolean default false,
  level           text,
  category        text,
  video_url       text,
  duration_confidence text
);

create index if not exists ex_focus_idx    on exercises using gin (focus_areas);
create index if not exists ex_equip_idx    on exercises using gin (equipment);
create index if not exists ex_touchpm_idx  on exercises (touches_per_min desc);
create index if not exists ex_session_idx  on exercises (session_id);
create index if not exists sess_program_idx on sessions (program_id);

-- ------------------------------------------------------------- USER STATE ---
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  position      text,
  dominant_foot text,
  level         text,
  season_phase  text,
  weaknesses    text[] default '{}',
  strengths     text[] default '{}',
  equipment     text[] default '{ball}',
  home_only     boolean default false,
  touch_goal    int default 1000,
  kid_mode      boolean default false,
  created_at    timestamptz default now()
);

-- One row per training session the player actually did (or saved to do).
-- `spec` stores what was asked for, so "order it again" can rebuild or replay.
create table if not exists workouts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  title         text not null,
  source        text not null default 'coach',   -- coach | library | plan
  source_ref    text,                            -- session id when from the library
  spec          jsonb,                           -- {minutes, focus[], place, level, goal}
  exercise_ids  text[] default '{}',             -- the drills as served
  planned_minutes numeric,
  planned_touches int,
  status        text not null default 'planned', -- planned | in_progress | completed
  completed_at  timestamptz,
  actual_minutes numeric,
  actual_touches int,
  created_at    timestamptz default now()
);
create index if not exists workouts_user_idx on workouts (user_id, created_at desc);

-- Which drills were ticked off inside a workout.
create table if not exists workout_items (
  id          uuid primary key default uuid_generate_v4(),
  workout_id  uuid references workouts(id) on delete cascade not null,
  exercise_id text references exercises(id),
  position    int,
  done        boolean default false,
  done_at     timestamptz
);
create index if not exists workout_items_idx on workout_items (workout_id);

-- The recurring order: a weekly template.
create table if not exists plans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text default 'My weekly blueprint',
  active      boolean default true,
  intake      jsonb,        -- position, weaknesses, availability, kit...
  created_at  timestamptz default now()
);

create table if not exists plan_days (
  id          uuid primary key default uuid_generate_v4(),
  plan_id     uuid references plans(id) on delete cascade not null,
  weekday     int not null check (weekday between 0 and 6),   -- 0 = Monday
  slot        int not null default 0,                          -- 0/1 for "Both" days
  kind        text not null,                                   -- rest | technical | physical
  session_id  text references sessions(id)
);
create index if not exists plan_days_idx on plan_days (plan_id, weekday);

-- --------------------------------------------------------------- SECURITY ---
alter table programs  enable row level security;
alter table sessions  enable row level security;
alter table exercises enable row level security;
alter table profiles      enable row level security;
alter table workouts      enable row level security;
alter table workout_items enable row level security;
alter table plans         enable row level security;
alter table plan_days     enable row level security;

-- library: readable by anyone, including signed-out visitors
drop policy if exists "library read" on programs;
drop policy if exists "library read" on sessions;
drop policy if exists "library read" on exercises;
create policy "library read" on programs  for select using (true);
create policy "library read" on sessions  for select using (true);
create policy "library read" on exercises for select using (true);

-- user data: owner only
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own workouts" on workouts;
create policy "own workouts" on workouts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own workout items" on workout_items;
create policy "own workout items" on workout_items for all
  using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));

drop policy if exists "own plans" on plans;
create policy "own plans" on plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own plan days" on plan_days;
create policy "own plan days" on plan_days for all
  using (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()));

-- create a profile row automatically on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
