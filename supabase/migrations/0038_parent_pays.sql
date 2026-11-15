-- 0038: families pay. A player's family pays Train.futbol by card each month
-- to keep training with their trainer, and the trainer pays nothing. The
-- other way (0037: the trainer pays for their players) stays, per academy.
--
--   academies            billing_mode and price_cents have been there since
--                        0004, unused. Two more: the day families started
--                        paying here, and how many days a player trains
--                        free first.
--   player_billing       One row per player whose family has started paying:
--                        their Stripe customer and subscription, and what
--                        Stripe last said about it.
--   academy_terms        What an academy charges, for the page that asks a
--                        family to pay. Public: it's the price.
--   admin_set_player_pay A platform admin turns families-pay on or off for
--                        an academy and sets its price and free days.
--
-- Only the server writes player_billing, with the service key, from
-- Stripe's own messages. A player reads their own row; their academy's
-- trainers read who is paying; nobody signed in can change it.
--
-- Safe to run more than once.

alter table academies add column if not exists players_pay_since timestamptz;
alter table academies add column if not exists player_trial_days int not null default 14;
do $$ begin
  alter table academies add constraint academies_player_trial_days_check check (player_trial_days between 0 and 365);
exception when duplicate_object then null; end $$;

create table if not exists player_billing (
  academy_id             uuid not null references academies(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  -- Stripe's word for the subscription, as in academy_billing.
  status                 text,
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now(),
  primary key (academy_id, user_id)
);
create index if not exists player_billing_user_idx on player_billing (user_id);
create index if not exists player_billing_customer_idx on player_billing (stripe_customer_id);

alter table player_billing enable row level security;
revoke all on player_billing from anon, authenticated;
grant select on player_billing to authenticated;

drop policy if exists "player billing read" on player_billing;
create policy "player billing read" on player_billing for select
  using (user_id = auth.uid() or public.is_staff(academy_id) or public.is_admin());

-- ------------------------------------------------------------------------
create or replace function public.academy_terms(p_academy uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mode', a.billing_mode,
    'price_cents', coalesce(a.price_cents, 1000),
    'trial_days', a.player_trial_days,
    'since', a.players_pay_since)
  from academies a where a.id = p_academy;
$$;
revoke all on function public.academy_terms(uuid) from public;
grant execute on function public.academy_terms(uuid) to anon, authenticated;

-- ------------------------------------------------------------------------
-- Turning it on starts everyone's free days from now, so nobody already
-- training here is asked to pay the same day. Turning it off forgets that.
create or replace function public.admin_set_player_pay(p_academy uuid, p_on boolean, p_price_cents int, p_trial_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_price_cents is null or p_price_cents < 100 or p_price_cents > 100000 then raise exception 'price out of range'; end if;
  if p_trial_days is null or p_trial_days < 0 or p_trial_days > 365 then raise exception 'days out of range'; end if;
  update academies set
    billing_mode = case when p_on then 'players_pay' else 'trainer_pays' end,
    price_cents = p_price_cents,
    player_trial_days = p_trial_days,
    players_pay_since = case when not p_on then null else coalesce(players_pay_since, now()) end
  where id = p_academy;
  if not found then raise exception 'no such academy'; end if;
end; $$;
revoke all on function public.admin_set_player_pay(uuid, boolean, int, int) from public;
grant execute on function public.admin_set_player_pay(uuid, boolean, int, int) to authenticated;
