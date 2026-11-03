-- Branding and the admin role, for the /admin panel.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor, or:
--
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_branding.sql
--
-- Until it runs the app is unbranded, which is what it was anyway, and /admin
-- says the migration is missing rather than failing.
--
-- Then make yourself an admin (sign in once first so the auth user exists):
--
--   insert into admins (user_id)
--   select id from auth.users where email = 'you@example.com';

-- ------------------------------------------------------------------ ADMINS ---
-- Its own table rather than a flag on profiles, because "own profile" lets a
-- player write every column of their own row — an is_admin there would be a
-- checkbox anyone could tick. Nothing here grants insert: admins are added in
-- SQL by someone who already has the database.
create table if not exists admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table admins enable row level security;

-- A user may see their own row, which is how the app asks "am I an admin".
drop policy if exists "see own admin row" on admins;
create policy "see own admin row" on admins for select using (auth.uid() = user_id);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- BRANDING ---
-- One row. `id = 1` with a check is the whole singleton mechanism.
create table if not exists branding (
  id            int primary key default 1 check (id = 1),
  enabled       boolean not null default false,
  name          text check (name is null or char_length(name) <= 40),
  palette_id    text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color  text check (accent_color  is null or accent_color  ~ '^#[0-9A-Fa-f]{6}$'),
  -- The logo lives in the row, base64, rather than in a Storage bucket: one
  -- file, a 512 KB cap enforced by the app, and no bucket policies to keep in
  -- step with these. It is never selected by the pages, only by /brand/logo.
  logo_type     text,
  logo_data     text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);
insert into branding (id) values (1) on conflict (id) do nothing;

alter table branding enable row level security;

-- Everyone sees the brand, signed in or not — it is the app's own face.
drop policy if exists "branding read" on branding;
create policy "branding read" on branding for select using (true);

drop policy if exists "branding admin write" on branding;
create policy "branding admin write" on branding for update
  using (public.is_admin()) with check (public.is_admin());
