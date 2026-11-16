import 'server-only';
import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BILLING_COLUMNS, PRICE_CENTS, PRICE_LOOKUP_KEY, isLive, type BillingRow } from './billing';
import { PLAYER_BILLING_COLUMNS, type PlayerBillingRow } from './membership';

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

/** Active players in an academy: what the owner pays for. Staff don't count. */
export async function playerCount(db: SupabaseClient, academyId: string): Promise<number> {
  const ask = () => db.from('academy_members')
    .select('user_id', { count: 'exact', head: true }).eq('academy_id', academyId).eq('role', 'player');
  // Not the ones switched off (0040): on the roster, not paid for.
  let { count, error } = await ask().eq('active', true);
  if (error?.code === '42703') ({ count, error } = await ask());
  if (error) throw error;
  return count ?? 0;
}

const at = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/**
 * Copies a subscription, as Stripe has it now, into academy_billing. Always
 * asked for fresh by id rather than read off a webhook, since Stripe's
 * messages can arrive out of order.
 */
export async function saveSubscription(s: Stripe, db: SupabaseClient, subscriptionId: string, academyHint?: string | null): Promise<{ kind: 'academy' | 'player'; academyId: string }> {
  const sub = await s.subscriptions.retrieve(subscriptionId);
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  // A family's membership (0038) says so, and whose it is.
  if (sub.metadata?.kind === 'player') return savePlayerSubscription(db, sub, customer);

  let academyId = sub.metadata?.academy_id || academyHint || null;
  if (!academyId) {
    const { data } = await db.from('academy_billing').select('academy_id').eq('stripe_customer_id', customer).maybeSingle();
    academyId = (data?.academy_id as string | undefined) ?? null;
  }
  if (!academyId) throw new Error(`stripe subscription ${sub.id} belongs to no academy`);

  // An old subscription's last words (cancelled) mustn't replace a newer one's.
  const { data: now } = await db.from('academy_billing').select('stripe_subscription_id, status').eq('academy_id', academyId).maybeSingle();
  if (now?.stripe_subscription_id && now.stripe_subscription_id !== sub.id && isLive(now.status as string | null) && !isLive(sub.status)) return { kind: 'academy', academyId };

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
  return { kind: 'academy', academyId };
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

// ---------------------------------------------------------------- FAMILIES ---
// Families pay (0038): one subscription per player per academy, charged to
// whoever holds the player's account. Stripe is told that account's email and
// the academy's name. Never the player's name.

/** A family's price, by its amount: found by lookup key, made the first time. */
const playerPrices = new Map<number, string>();
export async function ensurePlayerPrice(s: Stripe, cents: number): Promise<string> {
  const known = playerPrices.get(cents);
  if (known) return known;
  const key = `player_monthly_${cents}`;
  const found = await s.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const id = found.data[0]?.id ?? (await s.prices.create({
    currency: 'usd', unit_amount: cents, recurring: { interval: 'month' },
    lookup_key: key, product_data: { name: 'Train.futbol training plan' },
  })).id;
  playerPrices.set(cents, id);
  return id;
}

export async function readPlayerBilling(db: SupabaseClient, academyId: string, userId: string): Promise<PlayerBillingRow | null> {
  const { data, error } = await db.from('player_billing').select(PLAYER_BILLING_COLUMNS)
    .eq('academy_id', academyId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data as PlayerBillingRow | null) ?? null;
}

async function savePlayerSubscription(db: SupabaseClient, sub: Stripe.Subscription, customer: string): Promise<{ kind: 'player'; academyId: string }> {
  const academyId = sub.metadata?.academy_id, userId = sub.metadata?.user_id;
  if (!academyId || !userId) throw new Error(`stripe subscription ${sub.id} names no player`);
  // As for academies: an old subscription's ending mustn't replace a newer one.
  const { data: now } = await db.from('player_billing').select('stripe_subscription_id, status')
    .eq('academy_id', academyId).eq('user_id', userId).maybeSingle();
  if (now?.stripe_subscription_id && now.stripe_subscription_id !== sub.id && isLive(now.status as string | null) && !isLive(sub.status)) return { kind: 'player', academyId };
  const { error } = await db.from('player_billing').upsert({
    academy_id: academyId, user_id: userId,
    stripe_customer_id: customer,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: at(sub.items.data[0]?.current_period_end),
    trial_end: at(sub.trial_end),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'academy_id,user_id' });
  // The player or the academy is gone (23503): there's nothing to keep a copy for.
  if (error && error.code !== '23503') throw error;
  return { kind: 'player', academyId };
}

/**
 * Stops a family's payments when their player is no longer here: they left,
 * a trainer removed them, or the account was deleted. With no academy, every
 * membership the account has. Called before the row goes, since it holds the
 * subscription's id. Never throws: leaving must still work if Stripe is down,
 * and what couldn't be stopped is logged to be stopped by hand.
 */
export async function cancelPlayerBilling(userId: string, academyId?: string): Promise<void> {
  const s = stripe(), db = billingDb();
  if (!s || !db) return;
  try {
    let q = db.from('player_billing').select('stripe_subscription_id, status').eq('user_id', userId);
    if (academyId) q = q.eq('academy_id', academyId);
    const { data, error } = await q;
    if (error) throw error;
    for (const r of data ?? []) {
      if (!r.stripe_subscription_id || !isLive(r.status as string | null)) continue;
      try {
        await s.subscriptions.cancel(r.stripe_subscription_id as string);
      } catch (e) {
        console.error('cancelPlayerBilling: cancel by hand in Stripe', r.stripe_subscription_id, e);
      }
    }
  } catch (e) {
    // Before migration 0038 there's no table, and nothing to cancel.
    console.error('cancelPlayerBilling', e);
  }
}
