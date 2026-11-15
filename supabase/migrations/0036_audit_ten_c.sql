-- 0036: the tenth audit, third part.
--
--   player_plans.program_from  The day a player's week last went back to
--                        their program: its sessions that week go on the
--                        days from then, beside what they'd already done.
--   calendar_academy     Hands the calendar the same (as 0034, with plans).
--   academy_public       Says whether an academy is listed, so one kept to
--                        its invite link is kept out of search engines too.
--   claim_academy        Only a confirmed email address claims an academy.
--   new_invite_code      New invite and claim codes are 20 characters, not
--                        10. Links already out keep working.
--   profiles             What a player types about themselves is within
--                        reason, checked here as well as in the app.
--
-- Safe to run more than once.

alter table player_plans add column if not exists program_from date;

-- ------------------------------------------------------------------------
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
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('group_id', gm.group_id, 'user_id', gm.user_id, 'added_at', gm.added_at))
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
      'note', x.note, 'week_of', x.week_of, 'created_at', x.created_at))
      from addons x where x.academy_id = a and x.user_id = u and x.week_of > current_date - 21), '[]'::jsonb),
    'schedules', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'club_days', s.club_days, 'game_day', s.game_day,
      'game_days', s.game_days, 'trainer_days', s.trainer_days))
      from player_schedules s where s.user_id = u), '[]'::jsonb),
    'moves', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'week_of', m.week_of, 'item_key', m.item_key, 'weekday', m.weekday))
      from session_moves m where m.academy_id = a and m.user_id = u and m.week_of > current_date - 21), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('user_id', pl.user_id, 'mode', pl.mode, 'program_from', pl.program_from))
      from player_plans pl where pl.academy_id = a and pl.user_id = u), '[]'::jsonb),
    'custom', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'week_of', c.week_of,
      'position', c.position, 'name', c.name, 'drill_ids', c.drill_ids, 'weekday', c.weekday,
      'made_by', c.made_by, 'note', c.note, 'steps', c.steps, 'light', c.light))
      from player_week_sessions c where c.academy_id = a and c.user_id = u and c.week_of > current_date - 21), '[]'::jsonb)
  );
end; $$;
revoke all on function public.calendar_academy(text, text) from public;
grant execute on function public.calendar_academy(text, text) to anon, authenticated;

-- ------------------------------------------------------------------------
-- As 0033, with `listed`.
create or replace function public.academy_public(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'slug', a.slug, 'name', a.name, 'time_zone', a.time_zone,
    'palette_id', a.palette_id, 'primary_color', a.primary_color, 'accent_color', a.accent_color,
    'logo_type', a.logo_type, 'updated_at', a.updated_at, 'library_access', a.library_access,
    'kind', a.kind, 'open', a.open, 'listed', a.listed)
  from academies a where a.slug = p_slug;
$$;
revoke all on function public.academy_public(text) from public;
grant execute on function public.academy_public(text) to anon, authenticated;

-- ------------------------------------------------------------------------
-- As 0020, for a confirmed address only.
create or replace function public.claim_academy(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r academy_requests;
  me text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into r from academy_requests where claim_code = p_code for update;
  if not found or r.academy_id is null then raise exception 'claim not found'; end if;
  if r.claimed_at is not null then
    if exists (select 1 from academy_members where academy_id = r.academy_id
               and user_id = auth.uid() and role = 'owner') then
      return jsonb_build_object('slug', (select slug from academies where id = r.academy_id));
    end if;
    raise exception 'already claimed';
  end if;
  -- Only an address its owner has shown is theirs (the link or code we
  -- emailed): a sign-up nobody confirmed proves nothing about whose it is.
  select lower(email) into me from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if me is distinct from lower(r.email) then raise exception 'wrong email'; end if;

  insert into academy_members (academy_id, user_id, role) values (r.academy_id, auth.uid(), 'owner')
  on conflict (academy_id, user_id) do update set role = 'owner';
  update academy_requests set claimed_at = now(), status = 'set_up' where id = r.id;
  return jsonb_build_object('slug', (select slug from academies where id = r.academy_id));
end; $$;
revoke all on function public.claim_academy(text) from public, anon;
grant execute on function public.claim_academy(text) to authenticated;

-- ------------------------------------------------------------------------
-- Twenty characters (80 bits): not something a script finds by trying.
create or replace function public.new_invite_code() returns text
language sql volatile as $$
  select substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 20);
$$;

-- ------------------------------------------------------------------------
-- Checked from here on (not valid: rows from before aren't re-read).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_text_sane') then
    alter table profiles add constraint profiles_text_sane check (
      (display_name is null or char_length(display_name) <= 100) and
      (club is null or char_length(club) <= 120) and
      (region is null or char_length(region) <= 120) and
      ("position" is null or char_length("position") <= 60) and
      (positions is null or cardinality(positions) <= 20) and
      (speed_tests is null or pg_column_size(speed_tests) <= 200000) and
      (speed_year is null or pg_column_size(speed_year) <= 4000)) not valid;
  end if;
end $$;
