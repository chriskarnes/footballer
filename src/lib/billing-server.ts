import 'server-only';
import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BILLING_COLUMNS, PRICE_CENTS, PRICE_LOOKUP_KEY, isLive, type BillingRow } from './billing';

/**
 * Trainer billing through Stripe: $5 a player a month, charged to the
 * academy's owner. Stripe holds the card and takes the payments; this keeps a
 * copy of where each subscription stands (academy_billing, 0037) so the
 * Billing page doesn't ask Stripe on every load.
 *
 * Stripe is told the owner's email, the academy's name and a number of
 * players. Never a player's name or anything else about them.
 *
 * Off until STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY are both set:
 * the copy is written with the service key, since nobody signed in may
 * change it.
 */
let client: Stripe | null = null;
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return (client ??= new Stripe(key));
}

export function billingDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export const billingOn = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * The $5 price. STRIPE_PRICE_ID if one was made by hand; otherwise found by
 * its lookup key, and made the first time it's asked for, so there's nothing
 * to set up in Stripe's dashboard.
 */
let priceId: string | null = null;
export async function ensurePrice(s: Stripe): Promise<string> {
  if (process.env.STRIPE_PRICE_ID) return process.env.STRIPE_PRICE_ID;
  if (priceId) return priceId;
  const found = await s.prices.list({ lookup_keys: [PRICE_LOOKUP_KEY], active: true, limit: 1 });
  if (found.data[0]) return (priceId = found.data[0].id);
  const made = await s.prices.create({
    currency: 'usd', unit_amount: PRICE_CENTS, recurring: { interval: 'month' },
    lookup_key: PRICE_LOOKUP_KEY, product_data: { name: 'Train.futbol, per player' },
  });
  return (priceId = made.id);
}

export async function readBilling(db: SupabaseClient, academyId: string): Promise<BillingRow | null> {
  const { data, error } = await db.from('academy_billing').select(BILLING_COLUMNS).eq('academy_id', academyId).maybeSingle();
  if (error) throw error;
  return (data as BillingRow | null) ?? null;
}

/** Players in an academy: what the owner pays for. Staff don't count. */
export async function playerCount(db: SupabaseClient, academyId: string): Promise<number> {
  const { count, error } = await db.from('academy_members')
    .select('user_id', { count: 'exact', head: true }).eq('academy_id', academyId).eq('role', 'player');
  if (error) throw error;
  return count ?? 0;
}

const at = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/**
 * Copies a subscription, as Stripe has it now, into academy_billing. Always
 * asked for fresh by id rather than read off a webhook, since Stripe's
 * messages can arrive out of order.
 */
export async function saveSubscription(s: Stripe, db: SupabaseClient, subscriptionId: string, academyHint?: string | null) {
  const sub = await s.subscriptions.retrieve(subscriptionId);
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let academyId = sub.metadata?.academy_id || academyHint || null;
  if (!academyId) {
    const { data } = await db.from('academy_billing').select('academy_id').eq('stripe_customer_id', customer).maybeSingle();
    academyId = (data?.academy_id as string | undefined) ?? null;
  }
  if (!academyId) throw new Error(`stripe subscription ${sub.id} belongs to no academy`);

  // An old subscription's last words (cancelled) mustn't replace a newer one's.
  const { data: now } = await db.from('academy_billing').select('stripe_subscription_id, status').eq('academy_id', academyId).maybeSingle();
  if (now?.stripe_subscription_id && now.stripe_subscription_id !== sub.id && isLive(now.status as string | null) && !isLive(sub.status)) return academyId;

  const item = sub.items.data[0];
  const { error } = await db.from('academy_billing').upsert({
    academy_id: academyId,
    stripe_customer_id: customer,
    stripe_subscription_id: sub.id,
    status: sub.status,
    quantity: item?.quantity ?? 0,
    current_period_end: at(item?.current_period_end),
    trial_end: at(sub.trial_end),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'academy_id' });
  if (error) throw error;
  return academyId;
}

/**
 * Sets what the subscription charges for to the players there now. No
 * part-month charges or refunds: the new number is what the next payment is
 * for, which is what the site promises ("remove a player and you stop paying
 * for them next month").
 */
export async function syncSeats(s: Stripe, db: SupabaseClient, academyId: string): Promise<void> {
  const row = await readBilling(db, academyId);
  if (!row?.stripe_subscription_id || !isLive(row.status)) return;
  const players = await playerCount(db, academyId);
  if (players === row.quantity) return;
  const sub = await s.subscriptions.retrieve(row.stripe_subscription_id);
  const item = sub.items.data[0];
  if (!item || !isLive(sub.status)) return;
  if (item.quantity !== players) {
    await s.subscriptions.update(sub.id, { items: [{ id: item.id, quantity: players }], proration_behavior: 'none' });
  }
  await saveSubscription(s, db, sub.id, academyId);
}
