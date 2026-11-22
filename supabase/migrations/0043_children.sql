-- 0043: players under 13 (COPPA).
--
--   parent_consents      A parent's or guardian's agreement for a player
--                        under 13: who agreed (the email), when, to which
--                        version of the privacy policy, and how (in the app,
--                        signed in as the parent, or by a link emailed to
--                        them). Also when the account was first asked, which
--                        starts the 30 days after which an account nobody
--                        agreed to is deleted. Goes with the account.
--   inactive_players     The accounts the daily clean-up deletes for going
--                        unused for a year: players only (never staff or an
--                        admin), nobody still paying, never a sample account.
--   Existing data, once: players' names are cut to a first name and last
--   initial ("Jack Morris" becomes "Jack M.", as the app now saves them), and
--   players under 13 lose their photo, club and area, which the app no
--   longer keeps for them. Trainers' own names and photos are left alone.
--
-- Run after the app that uses these is deployed (until it runs, nobody is
-- asked for an agreement and nothing is cleaned up).
--
-- Safe to run more than once.

create table if not exists parent_consents (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  -- Where the request and the confirmation went: the parent's or guardian's.
  parent_email   text check (parent_email is null or char_length(parent_email) <= 200),
  -- sha256 of the emailed link's secret; cleared once it's used.
  token_hash     text unique,
  requested_at   timestamptz,
  first_asked_at timestamptz not null default now(),
  agreed_at      timestamptz,
  -- 'in_app' (signed in as the parent), 'email_link', or 'sample' (a seed's).
  method         text,
  -- The privacy policy's date when they agreed (LEGAL_UPDATED).
  notice_version text,
  confirm_sent_at timestamptz
);
create index if not exists parent_consents_waiting_idx on parent_consents (first_asked_at) where agreed_at is null;

alter table parent_consents enable row level security;
revoke all on parent_consents from anon, authenticated;
-- A player sees their own (the app says where the request went); everything
-- else is written by the server.
grant select (user_id, parent_email, requested_at, agreed_at) on parent_consents to authenticated;
drop policy if exists "consent read own" on parent_consents;
create policy "consent read own" on parent_consents for select using (user_id = auth.uid());

-- ------------------------------------------------------------------------
-- Accounts unused since p_before: no sign-in, no session renewed, no training
-- saved and no academy joined since then. Only for the server's own key.
create or replace function public.inactive_players(p_before timestamptz, p_limit int default 25)
returns table (user_id uuid)
language sql stable security definer set search_path = public, auth as $$
  select u.id
  from auth.users u
  where u.created_at < p_before
    and coalesce(u.last_sign_in_at, u.created_at) < p_before
    and coalesce(u.email, '') !~* '@train\.futbol$'
    and not exists (select 1 from academy_members m where m.user_id = u.id and m.role in ('owner', 'trainer'))
    and not exists (select 1 from admins a where a.user_id = u.id)
    and not exists (select 1 from player_billing b where b.user_id = u.id
                    and b.status is not null and b.status not in ('canceled', 'incomplete_expired'))
    and not exists (select 1 from auth.sessions s where s.user_id = u.id and s.updated_at >= p_before)
    and not exists (select 1 from workouts w where w.user_id = u.id and w.created_at >= p_before)
    and not exists (select 1 from academy_members m where m.user_id = u.id and m.joined_at >= p_before)
  order by u.created_at
  limit greatest(1, least(p_limit, 100));
$$;
revoke all on function public.inactive_players(timestamptz, int) from public, anon, authenticated;
grant execute on function public.inactive_players(timestamptz, int) to service_role;

-- ------------------------------------------------------------------------
-- A first name and last initial, the same as shortName() in src/lib/child.ts.
create or replace function public.short_name(n text) returns text
language sql immutable as $$
  select case
    when array_length(w, 1) > 1 and regexp_replace(w[array_length(w, 1)], '[^[:alnum:]]', '', 'g') <> ''
      then left(w[1], 40) || ' ' || upper(left(regexp_replace(w[array_length(w, 1)], '[^[:alnum:]]', '', 'g'), 1)) || '.'
    else left(w[1], 40)
  end
  from (select regexp_split_to_array(btrim(n), '\s+') as w) s;
$$;
revoke all on function public.short_name(text) from public, anon, authenticated;

-- Players' names (not anyone who trains or owns an academy anywhere).
update profiles p set display_name = public.short_name(p.display_name)
where p.display_name ~ '\S\s+\S'
  and public.short_name(p.display_name) is distinct from p.display_name
  and not exists (select 1 from academy_members m where m.user_id = p.id and m.role in ('owner', 'trainer'));

update join_requests r set name = public.short_name(r.name)
where r.name ~ '\S\s+\S' and public.short_name(r.name) is distinct from r.name;

-- Players under 13: no photo, club or area.
update profiles p set avatar_type = null, avatar_data = null, avatar_updated_at = null, region = null, club = null
where p.age_band in ('u10', '10_12')
  and (p.avatar_data is not null or p.region is not null or p.club is not null)
  and not exists (select 1 from academy_members m where m.user_id = p.id and m.role in ('owner', 'trainer'));
