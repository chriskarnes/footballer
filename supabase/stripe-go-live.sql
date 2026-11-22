-- Stripe: from test mode to live. Run ONCE, right before the live keys go in.
--
-- Not a migration: it isn't meant for every database in order, and running it
-- after live payments have started would forget real subscriptions (Stripe
-- would keep charging, and the app would stop knowing about it). Test and live
-- ids look the same, so nothing here can tell them apart: the timing is the
-- only guard.
--
-- Why it's needed: the billing tables still hold the customer and
-- subscription ids made while testing. Under a live key those ids don't
-- exist, so
--   * a family's checkout reuses its stored test customer and fails, and
--   * a row Stripe last called "active" reads as paid for good, because no
--     live message will ever change it: that player trains free.
--
-- What it keeps: academy_billing.free_until (a trainer's free months) and
-- player_trials (when each player's free days began). What it clears: every
-- Stripe id and the subscription state copied from Stripe. Afterwards a
-- player who "paid" in test mode is back in their free days if any are left,
-- or asked to add a card. A trainer who paid in test mode is asked again too.
--
-- The whole switch, in order:
--   1. Stripe dashboard, LIVE mode: finish activating the account (business
--      details, bank, statement descriptor, a support email that works).
--   2. Live mode: Developers > Webhooks > add an endpoint at
--      https://train.futbol/api/stripe/webhook, with these events:
--        checkout.session.completed
--        customer.subscription.created, .updated, .deleted, .paused, .resumed
--        invoice.upcoming
--      Copy its signing secret.
--   3. Live mode: Settings > Billing > Customer portal: save it once.
--      Then the failed-payment setting (Settings > Billing > Revenue
--      recovery, at the time of writing; Stripe moves it): when the last
--      retry fails, cancel the subscription. Left "past due", that player
--      keeps training.
--   4. Supabase SQL editor: paste this file, highlight just the PREVIEW
--      query and run it (the editor shows only the last result of a run).
--      If the numbers look right, run the whole file.
--   5. Vercel > Settings > Environment Variables: replace STRIPE_SECRET_KEY
--      (sk_live_...) and STRIPE_WEBHOOK_SECRET (the live endpoint's). Leave
--      STRIPE_PRICE_ID unset: the prices are made in live mode on first use.
--   6. Vercel > Deployments > Redeploy. New values only reach a new build.
--   7. Test mode: disable the old webhook endpoint for train.futbol. Its
--      secret no longer matches, so it would fail every time.
--   8. Add a real card on a player at an academy where families pay, check
--      Membership shows Active, then cancel it and refund it in Stripe.

-- ---------------------------------------------------------------- PREVIEW ---
-- What's about to be cleared. Read it before going on.
select 'academy_billing' as tbl, count(*) filter (where stripe_customer_id is not null) as with_customer,
       count(*) filter (where stripe_subscription_id is not null) as with_subscription,
       count(*) filter (where status in ('active', 'trialing', 'past_due')) as reads_as_live
from academy_billing
union all
select 'player_billing', count(*) filter (where stripe_customer_id is not null),
       count(*) filter (where stripe_subscription_id is not null),
       count(*) filter (where status in ('active', 'trialing', 'past_due'))
from player_billing;

-- --------------------------------------------------------------- CLEAN-UP ---
begin;

update academy_billing set
  stripe_customer_id = null,
  stripe_subscription_id = null,
  status = null,
  quantity = null,
  current_period_end = null,
  trial_end = null,
  cancel_at_period_end = false,
  updated_at = now()
where stripe_customer_id is not null or stripe_subscription_id is not null or status is not null;

update player_billing set
  stripe_customer_id = null,
  stripe_subscription_id = null,
  status = null,
  current_period_end = null,
  trial_end = null,
  cancel_at_period_end = false,
  price_cents = null,
  updated_at = now()
where stripe_customer_id is not null or stripe_subscription_id is not null or status is not null;

commit;

-- Should be all zeros now.
select 'academy_billing' as tbl, count(*) filter (where stripe_customer_id is not null or stripe_subscription_id is not null or status is not null) as left_over from academy_billing
union all
select 'player_billing', count(*) filter (where stripe_customer_id is not null or stripe_subscription_id is not null or status is not null) from player_billing;
