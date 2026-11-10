-- 0015: what players may do on their own, as the trainer allows.
--
--   - player_library: browse the academy's programs and drills, and run any
--     of them. (The licensed drill library stays behind library_access.)
--   - player_extras: sessions a week a player may add when they have time,
--     0 to 3. Built by rules from their focus and length, never by AI, and
--     added through add_extra_session, which keeps to the limit.
--
-- A player's own session is a player_week_sessions row made_by 'player'. It
-- sits on top of their week: it never replaces their program or custom week.
--
-- Run after 0014. Safe to run twice.

alter table academy_plan_defaults add column if not exists player_library boolean not null default false;
alter table academy_plan_defaults add column if not exists player_extras smallint not null default 0;
alter table academy_plan_defaults drop constraint if exists academy_plan_defaults_player_extras_check;
alter table academy_plan_defaults add constraint academy_plan_defaults_player_extras_check check (player_extras between 0 and 3);

alter table player_week_sessions drop constraint if exists player_week_sessions_made_by_check;
alter table player_week_sessions add constraint player_week_sessions_made_by_check
  check (made_by in ('rules', 'ai', 'trainer', 'player'));

-- Adds one of the player's own sessions to this week, within the limit.
create or replace function public.add_extra_session(
  p_academy uuid, p_week_of date, p_name text, p_drill_ids uuid[], p_steps smallint[], p_weekday smallint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  allowed int;
  used int;
  new_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from academy_members where academy_id = p_academy and user_id = auth.uid() and role = 'player'
  ) then raise exception 'not a player here'; end if;
  -- This week or last (time zones), never ahead.
  if p_week_of > current_date + 1 or p_week_of < current_date - 8 or extract(isodow from p_week_of) <> 1 then
    raise exception 'not this week';
  end if;
  select coalesce((select player_extras from academy_plan_defaults where academy_id = p_academy), 0) into allowed;
  select count(*) into used from player_week_sessions
    where academy_id = p_academy and user_id = auth.uid() and week_of = p_week_of and made_by = 'player';
  if used >= allowed then raise exception 'extra limit reached'; end if;
  if cardinality(p_drill_ids) not between 1 and 20
     or (select count(*) from drills where academy_id = p_academy and id = any(p_drill_ids)) <> cardinality(p_drill_ids) then
    raise exception 'bad drills';
  end if;
  insert into player_week_sessions (academy_id, user_id, week_of, position, name, drill_ids, steps, weekday, made_by)
  values (p_academy, auth.uid(), p_week_of, 100 + used, left(p_name, 40), p_drill_ids,
          coalesce(p_steps, '{}'), greatest(0, least(6, p_weekday)), 'player')
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.add_extra_session(uuid, date, text, uuid[], smallint[], smallint) from public;
grant execute on function public.add_extra_session(uuid, date, text, uuid[], smallint[], smallint) to authenticated;
