-- Calendar subscription feeds.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor, or:
--
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_calendar.sql
--
-- Until it runs, Me shows no calendar option and the Speed year stays in the
-- browser only, as it always has.

-- ------------------------------------------------------------- SPEED YEAR ---
-- {"monday": "YYYY-MM-DD", "phase": "foundation"} — the same shape the
-- browser stores. Here so the feed can see it; written by the app through
-- the existing "own profile" policy.
alter table profiles add column if not exists speed_year jsonb;

-- ---------------------------------------------------------- CALENDAR FEEDS ---
-- One per player. The token is the whole of the feed's security: a calendar
-- app fetches /cal/<token>.ics with no cookies, so whoever has the URL has the
-- schedule. Resetting replaces the token; turning off deletes the row.
create table if not exists calendar_feeds (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  token         text not null unique check (char_length(token) >= 32),
  include_plan  boolean not null default true,
  include_speed boolean not null default true,
  -- null is all-day events; 'HH:MM' is a timed event starting then.
  start_time    text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- IANA name from the player's device, e.g. 'Europe/London'. Only matters
  -- for timed events.
  time_zone     text not null default 'UTC',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table calendar_feeds enable row level security;

drop policy if exists "own calendar feed" on calendar_feeds;
create policy "own calendar feed" on calendar_feeds for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------ FEED READER ---
-- Everything one feed needs, found by token, in one call. Security definer so
-- the feed route needs no service-role key: knowing a token is the only way
-- to get anything out, and what comes out is that one player's schedule and
-- finished sessions — no name, no email.
create or replace function public.calendar_feed(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  f calendar_feeds;
begin
  select * into f from calendar_feeds where token = p_token;
  if not found then return null; end if;

  return jsonb_build_object(
    'include_plan',  f.include_plan,
    'include_speed', f.include_speed,
    'start_time',    f.start_time,
    'time_zone',     f.time_zone,
    'speed_year',    (select speed_year from profiles where id = f.user_id),
    'plan_days',     coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', d.weekday, 'slot', d.slot, 'kind', d.kind, 'session_id', d.session_id))
      from plans p join plan_days d on d.plan_id = p.id
      where p.user_id = f.user_id and p.active
    ), '[]'::jsonb),
    'completed',     coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', w.source, 'source_ref', w.source_ref, 'completed_at', w.completed_at))
      from workouts w
      where w.user_id = f.user_id and w.status = 'completed'
        and w.completed_at > now() - interval '60 days'
    ), '[]'::jsonb)
  );
end; $$;

revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
