-- Profile setup fields, for the "Let's set you up" empty state on Me.
--
-- NOT APPLIED AUTOMATICALLY. Run this against Supabase before (or shortly
-- after) the deploy that ships the empty state — the app degrades to the
-- columns that exist, so the order is not fatal either way, but until this
-- runs the four answers are collected and dropped.
--
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_profile_setup_fields.sql
--
-- All four are nullable with no default. A profile row that predates this
-- migration is a player who has answered none of it, and NULL is what that
-- means — a default would claim they had answered.

alter table profiles add column if not exists age_band text;

-- Plural, alongside the existing singular `position`. A player is a winger who
-- covers at full-back, and the drill filter wants both. `position` is left in
-- place rather than migrated: it has callers, and dropping a column is not a
-- thing to do in the same change that adds four.
alter table profiles add column if not exists positions text[] default '{}';

-- Below the line on the form, and below the line here: neither of these
-- changes a single drill. They are collected only if the player volunteers
-- them, and name + age band + club + region together narrow to a small number
-- of real children — which is why they are separable and skippable.
alter table profiles add column if not exists region text;
alter table profiles add column if not exists club   text;

-- Age band is a closed set. Stored as text rather than an enum so that
-- regrading the library's age groups is a data change, not a type change.
alter table profiles drop constraint if exists profiles_age_band_check;
alter table profiles add  constraint profiles_age_band_check
  check (age_band is null or age_band in ('u10', '10_12', '13_15', '16_18', '18_plus'));
