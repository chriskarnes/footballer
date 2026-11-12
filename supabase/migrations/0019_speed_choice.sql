-- 0019: Speed & Stamina, as the trainer's choice.
--
--   - player_speed: whether this academy's players get Speed & Stamina: the
--     Speed tab, "Get faster", and speed sessions in their calendar. On by
--     default; a trainer can turn it off for their players. Trainers keep it.
--
-- Turning it off hides Speed; it deletes nothing. A player's speed year and
-- test results stay, and are there again if it's turned back on.
--
-- Run after 0018. Safe to run twice.

alter table academy_plan_defaults add column if not exists player_speed boolean not null default true;

-- Whether a calendar feed's player gets Speed in this academy. The feed is
-- fetched by calendar servers with no session, so like calendar_feed and
-- calendar_academy it goes by the feed's token. On unless this player's
-- academy has turned it off.
create or replace function public.calendar_speed_on(p_token text, p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select d.player_speed
    from calendar_feeds f
    join academies a on a.slug = p_slug
    join academy_members m on m.academy_id = a.id and m.user_id = f.user_id and m.role = 'player'
    join academy_plan_defaults d on d.academy_id = a.id
    where f.token = p_token
  ), true);
$$;
revoke all on function public.calendar_speed_on(text, text) from public;
grant execute on function public.calendar_speed_on(text, text) to anon, authenticated;
