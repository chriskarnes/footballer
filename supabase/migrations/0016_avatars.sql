-- An optional photo on a player's profile.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor (see DEPLOY.md).
-- Safe to run twice. Until it runs, the app shows the first initial in the
-- circle, as it always has, and the "Add a photo" button says it isn't ready.
--
-- The photo lives in the row, base64, the way an academy's logo does (0002):
-- the app shrinks it to a 256px square before it is sent, so it is a few tens
-- of kilobytes, and one fewer moving part than a Storage bucket. It is never
-- selected by the pages, only by /me/avatar.
--
-- No new policy: "own profile" already lets a player read and write their own
-- row and nobody else's, so a photo is visible only to the player it belongs to.

alter table profiles add column if not exists avatar_type       text;
alter table profiles add column if not exists avatar_data       text;
alter table profiles add column if not exists avatar_updated_at timestamptz;
