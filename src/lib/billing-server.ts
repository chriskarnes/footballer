import 'server-only';
import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BILLING_COLUMNS, PRICE_CENTS, PRICE_LOOKUP_KEY, isLive, type BillingRow } from './billing';
import { PLAYER_BILLING_COLUMNS, type PlayerBillingRow } from './membership';
import { noColumn } from './academy-data';

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
  if (sub.metadata?.kind === 'player') return savePlayerSubscription(s, db, sub, customer);

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
  const { data, error } = await withPrice((cols) => db.from('player_billing').select(cols)
    .eq('academy_id', academyId).eq('user_id', userId).maybeSingle());
  if (error) throw error;
  return (data as PlayerBillingRow | null) ?? null;
}

/** A family's rows with what they pay (0042), or without it until that runs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function withPrice<R extends { error: any }>(ask: (cols: string) => PromiseLike<R>, lead = ''): Promise<R> {
  const r = await ask(`${lead}${PLAYER_BILLING_COLUMNS}, price_cents`);
  return r.error && noColumn(r.error) ? ask(`${lead}${PLAYER_BILLING_COLUMNS}`) : r;
}

/** Subscriptions that are running, or could be again: not ended, and past their first payment. */
const running = (status: string | null | undefined) => isLive(status) && status !== 'incomplete';

/**
 * Closes the checkout pages still open for a customer, so a card typed into
 * an old one (a second tab, a page left open) can't start a second
 * subscription, or one for a player who has since left. With `ref`, only the
 * ones for that academy (and player).
 */
export async function expireCheckouts(s: Stripe, customer: string, ref?: string): Promise<void> {
  try {
    const open = await s.checkout.sessions.list({ customer, status: 'open', limit: 20 });
    for (const o of open.data) {
      if (ref && o.client_reference_id !== ref) continue;
      try { await s.checkout.sessions.expire(o.id); } catch { /* finished or expired in the meantime */ }
    }
  } catch (e) {
    console.error('expireCheckouts', customer, e);
  }
}

/**
 * A subscription Stripe already has for this customer that we may not have
 * heard about yet (its message is still on the way): the answer to "are they
 * already paying?" before another checkout is opened.
 */
export async function runningSubscription(s: Stripe, customer: string, mine: (m: Stripe.Metadata) => boolean): Promise<string | null> {
  const all = await s.subscriptions.list({ customer, status: 'all', limit: 100 });
  return all.data.find((x) => running(x.status) && mine(x.metadata ?? {}))?.id ?? null;
}

/**
 * Coming back from Stripe's checkout: reads what was just paid for straight
 * from Stripe, without waiting for its message, so the page they land on
 * already knows. `ref` is who the checkout must have been for.
 */
export async function syncCheckout(sessionId: string, ref: string): Promise<void> {
  const s = stripe(), db = billingDb();
  if (!s || !db || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) return;
  try {
    const session = await s.checkout.sessions.retrieve(sessionId);
    const id = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (session.client_reference_id !== ref || !id) return;
    const saved = await saveSubscription(s, db, id, ref.split(':')[0]);
    if (saved.kind === 'academy') await syncSeats(s, db, saved.academyId);
  } catch (e) {
    // Stripe's own message will still arrive and say the same.
    console.error('syncCheckout', e);
  }
}

async function savePlayerSubscription(s: Stripe, db: SupabaseClient, sub: Stripe.Subscription, customer: string): Promise<{ kind: 'player'; academyId: string }> {
  const academyId = sub.metadata?.academy_id, userId = sub.metadata?.user_id;
  if (!academyId || !userId) throw new Error(`stripe subscription ${sub.id} names no player`);
  // Paid for from a checkout page left open after the player left or was
  // removed: there's nobody here to pay for, so it's stopped before a second
  // payment. Only when the read worked and found nobody.
  if (isLive(sub.status)) {
    const { data: member, error: me } = await db.from('academy_members').select('user_id')
      .eq('academy_id', academyId).eq('user_id', userId).eq('role', 'player').maybeSingle();
    if (!me && !member) {
      console.error('stripe subscription for someone not a player here: cancelled. Refund in Stripe if it was charged.', sub.id);
      await s.subscriptions.cancel(sub.id);
      return { kind: 'player', academyId };
    }
  }
  // As for academies: an old subscription's ending mustn't replace a newer one.
  const { data: now } = await db.from('player_billing').select('stripe_subscription_id, status')
    .eq('academy_id', academyId).eq('user_id', userId).maybeSingle();
  if (now?.stripe_subscription_id && now.stripe_subscription_id !== sub.id && isLive(now.status as string | null) && !isLive(sub.status)) return { kind: 'player', academyId };
  const row = {
    academy_id: academyId, user_id: userId,
    stripe_customer_id: customer,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: at(sub.items.data[0]?.current_period_end),
    trial_end: at(sub.trial_end),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };
  // What this family pays (0042): a price changed since is for new families.
  let { error } = await db.from('player_billing').upsert({ ...row, price_cents: sub.items.data[0]?.price?.unit_amount ?? null }, { onConflict: 'academy_id,user_id' });
  if (error && noColumn(error)) ({ error } = await db.from('player_billing').upsert(row, { onConflict: 'academy_id,user_id' }));
  // The player or the academy is gone (23503): there's nothing to keep a copy for.
  if (error && error.code !== '23503') throw error;
  return { kind: 'player', academyId };
}

type PlayerSub = { academy_id: string; user_id: string; stripe_subscription_id: string | null; stripe_customer_id: string | null; status: string | null };

/**
 * The card payments an account has: at one academy, or everywhere. Null when
 * they couldn't be read (so nothing can be said to have been stopped); empty
 * where billing is off or the table isn't there yet.
 */
export async function playerSubscriptions(userId: string, academyId?: string): Promise<PlayerSub[] | null> {
  const db = billingDb();
  if (!stripe() || !db) return [];
  let q = db.from('player_billing').select('academy_id, user_id, stripe_subscription_id, stripe_customer_id, status').eq('user_id', userId);
  if (academyId) q = q.eq('academy_id', academyId);
  const { data, error } = await q;
  if (error) {
    if (noColumn(error)) return [];
    console.error('playerSubscriptions', error);
    return null;
  }
  return (data ?? []) as PlayerSub[];
}

/**
 * Stops payments: cancelled for good (left, removed, account deleted), or
 * paused (switched off by their trainer: nothing is charged while they're
 * off, and it carries on when they're back, with no second first payment).
 * Open checkout pages for them are closed too. Returns how many couldn't be
 * stopped, so whoever asked is told instead of a line in a log.
 */
export async function stopSubscriptions(rows: PlayerSub[], how: 'cancel' | 'pause' = 'cancel'): Promise<number> {
  const s = stripe();
  if (!s) return 0;
  let failed = 0;
  for (const r of rows) {
    if (r.stripe_customer_id) await expireCheckouts(s, r.stripe_customer_id, `${r.academy_id}:${r.user_id}`);
    if (!r.stripe_subscription_id || !isLive(r.status)) continue;
    try {
      if (how === 'pause') await s.subscriptions.update(r.stripe_subscription_id, { pause_collection: { behavior: 'void' } });
      else await s.subscriptions.cancel(r.stripe_subscription_id);
    } catch (e) {
      // Already gone at Stripe's end is as good as stopped.
      if ((e as { code?: string })?.code === 'resource_missing') continue;
      failed++;
      console.error(`stopSubscriptions: ${how} by hand in Stripe`, r.stripe_subscription_id, e);
    }
  }
  return failed;
}

/** Stops a family's payments at one academy, or everywhere. `failed`: how many couldn't be. */
export async function cancelPlayerBilling(userId: string, academyId?: string, how: 'cancel' | 'pause' = 'cancel'): Promise<{ failed: number }> {
  const rows = await playerSubscriptions(userId, academyId);
  if (!rows) return { failed: 1 };
  return { failed: await stopSubscriptions(rows, how) };
}

/** Back on after being switched off: payments carry on from the next one due. */
export async function resumePlayerBilling(userId: string, academyId: string): Promise<{ failed: number }> {
  const s = stripe();
  const rows = await playerSubscriptions(userId, academyId);
  if (!rows) return { failed: 1 };
  let failed = 0;
  for (const r of rows) {
    if (!s || !r.stripe_subscription_id || !isLive(r.status)) continue;
    try {
      await s.subscriptions.update(r.stripe_subscription_id, { pause_collection: '' });
    } catch (e) {
      failed++;
      console.error('resumePlayerBilling', r.stripe_subscription_id, e);
    }
  }
  return { failed };
}

/**
 * Who pays at an academy has changed: the payments that no longer apply are
 * stopped. Families' when families no longer pay here; the trainer's when
 * the trainer no longer does. Returns how many couldn't be stopped.
 */
export async function stopBillingNotFor(academyId: string, mode: 'players_pay' | 'trainer_pays' | 'none'): Promise<number> {
  const s = stripe(), db = billingDb();
  if (!s || !db) return 0;
  let failed = 0;
  if (mode !== 'players_pay') {
    const { data, error } = await db.from('player_billing').select('academy_id, user_id, stripe_subscription_id, stripe_customer_id, status').eq('academy_id', academyId);
    if (error && !noColumn(error)) failed++;
    failed += await stopSubscriptions((data ?? []) as PlayerSub[]);
  }
  if (mode !== 'trainer_pays') {
    const { data, error } = await db.from('academy_billing').select('stripe_subscription_id, stripe_customer_id, status').eq('academy_id', academyId).maybeSingle();
    if (error && !noColumn(error)) failed++;
    if (data?.stripe_customer_id) await expireCheckouts(s, data.stripe_customer_id as string, academyId);
    if (data?.stripe_subscription_id && isLive(data.status as string | null)) {
      try {
        await s.subscriptions.cancel(data.stripe_subscription_id as string);
      } catch (e) {
        if ((e as { code?: string })?.code !== 'resource_missing') { failed++; console.error('stopBillingNotFor: cancel by hand in Stripe', data.stripe_subscription_id, e); }
      }
    }
  }
  return failed;
}
