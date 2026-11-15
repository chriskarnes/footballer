-- 0035: the tenth audit, second part.
--
--   coach_allow          The free-text session describer has a limit that
--                        lasts: a count per account per day, kept here. It
--                        was a counter in each server's memory, which every
--                        new server instance started again from nothing.
--   plans.client_id      A week saved twice (the answer lost to the signal,
--                        or two tabs sending the same one) is one week.
--   academy_completions  Can be asked for one player, so a build for one
--                        player doesn't read the whole academy's sessions
--                        and lose the newest past the row limit.
--   replace_built_week   A player's built week is swapped in one step,
--                        one build at a time: two builds started together
--                        used to both go in, doubling the week.
--   note_recipients      A player sees their own row, not who else a note
--                        went to or whether they've read it.
--   answer_join_request  Lets in only the request the trainer was looking
--                        at: a player request that has since become a
--                        trainer one isn't approved by a tap on the old card.
--   admin_remove_member  Replaces the invite link as it removes, so the
--                        link they joined with doesn't let them back in.
--   leave_academy        A player or trainer can leave an academy.
--   delete_account       Anyone can delete their account and everything in it.
--
-- Run after the app that uses these is deployed (it falls back to the old
-- ways until this runs, except leaving and deleting, which say to try later).
--
-- Safe to run more than once.

-- ------------------------------------------------------------------------
-- The session describer: one row a message, counted per account per day.
create table if not exists coach_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists coach_usage_user_idx on coach_usage (user_id, created_at);
alter table coach_usage enable row level security;
revoke all on coach_usage from anon, authenticated;

-- True when this account may send another, and counts it. The check and the
-- count are one step, so messages sent together can't all slip under.
create or replace function public.coach_allow(p_per_day int default 40) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext('coach:' || me::text));
  if (select count(*) from coach_usage where user_id = me and created_at > now() - interval '1 day')
       >= greatest(1, least(coalesce(p_per_day, 40), 200)) then
    return false;
  end if;
  insert into coach_usage (user_id) values (me);
  -- Nothing older than a week is needed.
  delete from coach_usage where user_id = me and created_at < now() - interval '7 days';
  return true;
end; $$;
revoke all on function public.coach_allow(int) from public, anon;
grant execute on function public.coach_allow(int) to authenticated;

-- ------------------------------------------------------------------------
-- A saved week's own id from the phone, as workouts have (0025).
alter table plans add column if not exists client_id uuid;
create unique index if not exists plans_user_client on plans (user_id, client_id) where client_id is not null;

-- ------------------------------------------------------------------------
-- As 0027, with an optional player.
drop function if exists public.academy_completions(uuid, timestamptz);
create or replace function public.academy_completions(p_academy uuid, p_since timestamptz, p_player uuid default null)
returns table (user_id uuid, source text, source_ref text, completed_at timestamptz, feel text, done_ids text[])
language sql stable security definer set search_path = public as $$
  select w.user_id, w.source, w.source_ref, w.completed_at, w.feel, w.done_ids
  from workouts w
  join academy_members m on m.user_id = w.user_id and m.academy_id = p_academy and m.role = 'player'
  where public.is_staff(p_academy)
    and (p_player is null or w.user_id = p_player)
    and w.status = 'completed' and w.source in ('academy', 'addon')
    and w.completed_at >= p_since
    and not public.elsewhere(p_academy, w.source, w.source_ref)
  order by w.completed_at;
$$;
revoke all on function public.academy_completions(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.academy_completions(uuid, timestamptz, uuid) to authenticated;

-- ------------------------------------------------------------------------
-- Swaps a player's built week: the new sessions in, the old ones out, or
-- neither. Runs as the trainer calling it, so the table's own rules still
-- decide what they may write. One at a time per player and week; and only
-- if the week is still the one the build read (p_keep: sessions already
-- done, which stay; p_old: the rest, which go). If someone else has rebuilt
-- it since, nothing changes and the caller is told.
create or replace function public.replace_built_week(
  p_academy uuid, p_user uuid, p_week_of date, p_keep uuid[], p_old uuid[], p_rows jsonb
) returns void
language plpgsql set search_path = public as $$
declare
  n int;
begin
  perform pg_advisory_xact_lock(hashtext('week:' || p_academy::text || ':' || p_user::text || ':' || p_week_of::text));
  select count(*) into n from player_week_sessions
   where academy_id = p_academy and user_id = p_user and week_of = p_week_of and made_by <> 'player'
     and id <> all (coalesce(p_keep, '{}') || coalesce(p_old, '{}'));
  if n > 0 or (select count(*) from player_week_sessions
                where academy_id = p_academy and user_id = p_user and week_of = p_week_of
                  and id = any (coalesce(p_old, '{}'))) <> cardinality(coalesce(p_old, '{}')) then
    raise exception 'week changed';
  end if;
  insert into player_week_sessions (academy_id, user_id, week_of, position, name, drill_ids, weekday, made_by, note, steps, light, changes)
  select p_academy, p_user, p_week_of, (r->>'position')::smallint, r->>'name',
         array(select jsonb_array_elements_text(r->'drill_ids'))::uuid[],
         (r->>'weekday')::smallint, r->>'made_by', r->>'note',
         array(select jsonb_array_elements_text(coalesce(r->'steps', '[]'::jsonb)))::smallint[],
         coalesce((r->>'light')::boolean, false),
         array(select jsonb_array_elements_text(coalesce(r->'changes', '[]'::jsonb)))
    from jsonb_array_elements(p_rows) r;
  delete from player_week_sessions where academy_id = p_academy and id = any (coalesce(p_old, '{}'));
end; $$;
revoke all on function public.replace_built_week(uuid, uuid, date, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.replace_built_week(uuid, uuid, date, uuid[], uuid[], jsonb) to authenticated;

-- ------------------------------------------------------------------------
-- Who a note went to: your own row, or all of them for the academy's staff.
-- (It was "anyone who can read the note", which is every recipient.)
drop policy if exists "note recipients read" on note_recipients;
create policy "note recipients read" on note_recipients for select
  using (user_id = auth.uid()
      or exists (select 1 from notes n where n.id = note_id and public.is_staff(n.academy_id)));

-- ------------------------------------------------------------------------
-- As 0028, with the kind of request the trainer was shown.
drop function if exists public.answer_join_request(uuid, uuid, boolean);
create or replace function public.answer_join_request(p_academy uuid, p_user uuid, p_approve boolean, p_role text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r join_requests;
begin
  if not public.is_staff(p_academy) then raise exception 'not staff'; end if;
  select * into r from join_requests where academy_id = p_academy and user_id = p_user and declined_at is null;
  if not found then raise exception 'no such request'; end if;
  -- Asked as a player when the card was drawn, as a trainer now: not the
  -- request that was answered.
  if p_role is not null and p_role is distinct from r.role then raise exception 'request changed'; end if;
  if r.role = 'trainer' and public.academy_role(p_academy) is distinct from 'owner' then
    raise exception 'only the owner lets trainers in';
  end if;
  if p_approve then
    insert into academy_members (academy_id, user_id, role) values (p_academy, p_user, r.role)
    on conflict (academy_id, user_id) do update
      set role = case when excluded.role = 'trainer' and academy_members.role = 'player' then 'trainer' else academy_members.role end;
    if r.role = 'player' then
      insert into profiles (id, display_name, signed_up_by) values (p_user, r.name, r.as_who)
      on conflict (id) do update set
        display_name = case when public.placeholder_name(p_user, profiles.display_name)
                            then excluded.display_name else profiles.display_name end,
        signed_up_by = coalesce(profiles.signed_up_by, excluded.signed_up_by);
    end if;
    delete from join_requests where academy_id = p_academy and user_id = p_user;
  else
    update join_requests set declined_at = now() where academy_id = p_academy and user_id = p_user;
  end if;
end; $$;
revoke all on function public.answer_join_request(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.answer_join_request(uuid, uuid, boolean, text) to authenticated;

-- ------------------------------------------------------------------------
-- As 0033, and the invite link is replaced in the same step: the one they
-- joined with stops working. (An open space is still one tap for anyone;
-- close it first to keep someone out.)
create or replace function public.admin_remove_member(p_academy uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if not exists (select 1 from academies where id = p_academy and kind = 'self_serve') then
    raise exception 'not self-serve';
  end if;
  delete from academy_members where academy_id = p_academy and user_id = p_user and role = 'player';
  if not found then raise exception 'not a member'; end if;
  insert into academy_invites (code, academy_id, role) values (public.new_invite_code(), p_academy, 'player')
  on conflict (academy_id, role) do update set code = excluded.code, created_at = now();
end; $$;
revoke all on function public.admin_remove_member(uuid, uuid) from public, anon;
grant execute on function public.admin_remove_member(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------------
-- Leaving an academy: out of it, its groups and programs, and the weeks
-- still to come. What they've done stays in their own history. The owner
-- can't leave: the academy would have nobody.
create or replace function public.leave_academy(p_academy uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r text;
  monday date;
begin
  if me is null then raise exception 'not signed in'; end if;
  select role into r from academy_members where academy_id = p_academy and user_id = me;
  if r is null then return; end if;
  if r = 'owner' then raise exception 'owner cannot leave'; end if;
  monday := date_trunc('week', (now() at time zone (select time_zone from academies where id = p_academy)))::date;
  delete from academy_members where academy_id = p_academy and user_id = me;
  delete from group_members where academy_id = p_academy and user_id = me;
  delete from player_programs where academy_id = p_academy and user_id = me;
  delete from player_plans where academy_id = p_academy and user_id = me;
  delete from player_week_sessions where academy_id = p_academy and user_id = me and week_of >= monday;
  delete from addons where academy_id = p_academy and user_id = me and week_of >= monday;
  delete from session_moves where academy_id = p_academy and user_id = me and week_of >= monday;
  delete from join_requests where academy_id = p_academy and user_id = me;
end; $$;
revoke all on function public.leave_academy(uuid) from public, anon;
grant execute on function public.leave_academy(uuid) to authenticated;

-- ------------------------------------------------------------------------
-- Deleting an account: the sign-in and everything kept under it (profile,
-- photo, training history, plans, calendar link, memberships, requests),
-- which all go with the account row. Notes a trainer sent stay with the
-- players they were sent to, without the account behind them. An academy's
-- owner hands it over or has it closed first: deleting them would leave its
-- players with nobody.
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if exists (select 1 from academy_members where user_id = me and role = 'owner') then
    raise exception 'owns an academy';
  end if;
  delete from auth.users where id = me;
end; $$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
