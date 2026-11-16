-- 0040: families pay by default, some academies pay nothing, and a player
-- can be switched off without being removed.
--
--   academies.billing_mode   A third value, 'none': nobody is billed (the
--                        demo and the platform's own academies). New
--                        academies start on 'players_pay'. Ones already here
--                        keep what they have, except the four named below.
--   academy_members.active   Off: the player keeps their account, history
--                        and place on the roster, but can't open their
--                        training, isn't counted in what the trainer pays,
--                        and their family isn't charged.
--   academy_members.paid_marked_at  A trainer's own note that a player has
--                        paid them, for trainers who collect their own way.
--   set_player_active, set_player_paid   Trainers change the two above.
--   admin_set_billing    A platform admin picks who pays at an academy.
--
-- Safe to run more than once.

do $$ begin
  alter table academies drop constraint if exists academies_billing_mode_check;
  alter table academies add constraint academies_billing_mode_check
    check (billing_mode in ('trainer_pays', 'players_pay', 'none'));
end $$;
alter table academies alter column billing_mode set default 'players_pay';

-- The platform's own: the public demo, the private academy, the training
-- one and the self-serve space. Nobody pays for these.
update academies set billing_mode = 'none', players_pay_since = null
  where slug in ('demo', 'forge', 'forge-training', 'play');

alter table academy_members add column if not exists active boolean not null default true;
alter table academy_members add column if not exists paid_marked_at timestamptz;

-- ------------------------------------------------------------------------
create or replace function public.set_player_active(p_academy uuid, p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(p_academy) then raise exception 'staff only'; end if;
  update academy_members set active = p_active
    where academy_id = p_academy and user_id = p_user and role = 'player';
  if not found then raise exception 'not a player here'; end if;
end; $$;
revoke all on function public.set_player_active(uuid, uuid, boolean) from public;
grant execute on function public.set_player_active(uuid, uuid, boolean) to authenticated;

create or replace function public.set_player_paid(p_academy uuid, p_user uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(p_academy) then raise exception 'staff only'; end if;
  update academy_members set paid_marked_at = case when p_paid then now() else null end
    where academy_id = p_academy and user_id = p_user and role = 'player';
  if not found then raise exception 'not a player here'; end if;
end; $$;
revoke all on function public.set_player_paid(uuid, uuid, boolean) from public;
grant execute on function public.set_player_paid(uuid, uuid, boolean) to authenticated;

-- ------------------------------------------------------------------------
-- As admin_set_player_pay (0038), with the third choice. Turning families-pay
-- on starts everyone's free days from now; any other choice forgets that.
create or replace function public.admin_set_billing(p_academy uuid, p_mode text, p_price_cents int, p_trial_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_mode not in ('trainer_pays', 'players_pay', 'none') then raise exception 'no such mode'; end if;
  if p_price_cents is null or p_price_cents < 100 or p_price_cents > 100000 then raise exception 'price out of range'; end if;
  if p_trial_days is null or p_trial_days < 0 or p_trial_days > 365 then raise exception 'days out of range'; end if;
  update academies set
    billing_mode = p_mode,
    price_cents = p_price_cents,
    player_trial_days = p_trial_days,
    players_pay_since = case when p_mode = 'players_pay' then coalesce(players_pay_since, now()) else null end
  where id = p_academy;
  if not found then raise exception 'no such academy'; end if;
end; $$;
revoke all on function public.admin_set_billing(uuid, text, int, int) from public;
grant execute on function public.admin_set_billing(uuid, text, int, int) to authenticated;
