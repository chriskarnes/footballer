-- Sessions as library items of their own: built once, used in any week of
-- any program.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor (see DEPLOY.md).
-- Safe to run twice. Until it runs, programs work as before and the Sessions
-- tab says it isn't ready.
--
--   library_sessions   a named, ordered list of drills. The thing a trainer builds.
--   academy_sessions   unchanged in shape: one row per place a session sits
--                      (program, week, position). It gains library_id, the
--                      session it is a use of.
--
-- A placement keeps its own copy of the name and drills, kept in step with
-- its library session by the trigger below. That is deliberate: everything
-- that reads a player's week (the week builder, the runner, the calendar
-- feed, completions keyed on the placement's id) goes on reading
-- academy_sessions exactly as it did, and needs no change.

create table if not exists library_sessions (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  drill_ids   uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists library_sessions_academy_idx on library_sessions (academy_id, name);

-- Deleting a library session leaves any placement as it was, on its own.
alter table academy_sessions add column if not exists library_id uuid references library_sessions(id) on delete set null;
create index if not exists academy_sessions_library_idx on academy_sessions (library_id);

-- -------------------------------------------------------------------- RLS ---
-- Trainers only: players read their week from academy_sessions, never from here.
alter table library_sessions enable row level security;
revoke all on library_sessions from anon;
grant select, insert, update, delete on library_sessions to authenticated;
drop policy if exists "library_sessions staff" on library_sessions;
create policy "library_sessions staff" on library_sessions for all
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

-- ------------------------------------------------------------------- SYNC ---
-- Change a library session and every place it is used follows.
create or replace function public.sync_library_session() returns trigger
language plpgsql as $$
begin
  if new.name is distinct from old.name or new.drill_ids is distinct from old.drill_ids then
    update academy_sessions set name = new.name, drill_ids = new.drill_ids where library_id = new.id;
  end if;
  return new;
end; $$;
drop trigger if exists library_sessions_sync on library_sessions;
create trigger library_sessions_sync after update on library_sessions
  for each row execute function public.sync_library_session();

-- --------------------------------------------------------------- BACKFILL ---
-- Every session already in a program becomes a library session. Ones that
-- are the same (a week copied into the next) become one, used twice.
insert into library_sessions (academy_id, name, drill_ids)
select distinct s.academy_id, s.name, s.drill_ids
from academy_sessions s
where s.library_id is null
  and not exists (select 1 from library_sessions l
                  where l.academy_id = s.academy_id and l.name = s.name and l.drill_ids = s.drill_ids);

update academy_sessions s set library_id = (
  select l.id from library_sessions l
  where l.academy_id = s.academy_id and l.name = s.name and l.drill_ids = s.drill_ids
  order by l.created_at limit 1)
where s.library_id is null;
