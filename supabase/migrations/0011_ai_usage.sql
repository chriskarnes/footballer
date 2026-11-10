-- 0011: every AI call, logged; and a line for the player on built sessions.
--
-- The log is what the limits read (a few builds per player a week, a
-- ceiling per academy a month), and what a usage meter will show. A call
-- that fails is logged too: it still cost something.
--
-- Run after 0010. Safe to run twice.

create table if not exists ai_usage (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  -- Who pressed the button; null when Autopilot ran it.
  actor_id      uuid references auth.users(id) on delete set null,
  -- Who it was for.
  player_id     uuid references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('week', 'suggest')),
  model         text,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  ok            boolean not null default true,
  -- A fingerprint of what went in, so an unchanged week needn't be asked again.
  input_hash    text,
  created_at    timestamptz not null default now()
);
create index if not exists ai_usage_academy_idx on ai_usage (academy_id, created_at);
create index if not exists ai_usage_player_idx on ai_usage (player_id, kind, created_at);

alter table ai_usage enable row level security;
drop policy if exists "ai usage read" on ai_usage;
create policy "ai usage read" on ai_usage for select using (public.is_staff(academy_id));
drop policy if exists "ai usage write" on ai_usage;
create policy "ai usage write" on ai_usage for insert with check (public.is_staff(academy_id));

-- One line to the player about the session ("All left foot today."), when
-- the AI wrote one.
alter table player_week_sessions add column if not exists note text check (note is null or char_length(note) <= 200);
