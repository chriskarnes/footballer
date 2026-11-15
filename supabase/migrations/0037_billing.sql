-- 0037: trainer billing. $5 a player a month, paid by the academy's owner
-- through Stripe.
--
--   academy_billing      One row per academy that has started paying, or has
--                        been given free time: its Stripe customer and
--                        subscription, what Stripe last said about it, and
--                        the day its free time ends.
--   admin_set_free_until A platform admin gives an academy free time (a
--                        founding trainer's first weeks), or takes it away.
--
-- Only the server writes here, with the service key, from Stripe's own
-- messages (app/api/stripe/webhook). The owner and platform admins can read
-- their row; nobody signed in can change it.
--
-- Safe to run more than once.

create table if not exists academy_billing (
  academy_id             uuid primary key references academies(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- Stripe's word for the subscription: trialing, active, past_due, unpaid,
  -- canceled, incomplete, incomplete_expired, paused. Null: no card yet.
  status                 text,
  -- Players the subscription is charging for.
  quantity               int check (quantity is null or quantity >= 0),
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean not null default false,
  -- Free through this day. A card added before it isn't charged until after.
  free_until             date,
  updated_at             timestamptz not null default now()
);

alter table academy_billing enable row level security;
revoke all on academy_billing from anon, authenticated;
grant select on academy_billing to authenticated;

drop policy if exists "billing read" on academy_billing;
create policy "billing read" on academy_billing for select
  using (public.academy_role(academy_id) = 'owner' or public.is_admin());

-- ------------------------------------------------------------------------
create or replace function public.admin_set_free_until(p_academy uuid, p_until date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  insert into academy_billing (academy_id, free_until) values (p_academy, p_until)
  on conflict (academy_id) do update set free_until = excluded.free_until, updated_at = now();
end; $$;
revoke all on function public.admin_set_free_until(uuid, date) from public;
grant execute on function public.admin_set_free_until(uuid, date) to authenticated;
