/**
 * Trainer billing, the parts with no Stripe in them: what a trainer owes, when
 * their free time ends, and the sentence the Billing page says about it.
 * Stripe itself is in billing-server.ts.
 */

/** $5 a player a month: the same number the site's pricing gives. */
export const PRICE_CENTS = 500;

/** How Stripe finds the price, so it's made once and reused. */
export const PRICE_LOOKUP_KEY = 'trainer_player_monthly';

export type BillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  quantity: number | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  free_until: string | null;
};

export const BILLING_COLUMNS =
  'stripe_customer_id, stripe_subscription_id, status, quantity, current_period_end, trial_end, cancel_at_period_end, free_until';

export const monthlyCents = (players: number) => Math.max(0, Math.floor(players)) * PRICE_CENTS;

export const dollars = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 });

/** A subscription that is still running, or could be again without a new one. */
export const isLive = (status: string | null | undefined) =>
  !!status && !['canceled', 'incomplete_expired'].includes(status);

const DAY = 86_400_000;

/**
 * When a new subscription's free time ends, in Unix seconds, or null for
 * none. The free day runs to its end (UTC). Stripe wants a trial's end at
 * least two days out, so free time with less than that left is no trial: the
 * first payment is taken when the card is added.
 */
export function trialEndFor(freeUntil: string | null | undefined, now: number): number | null {
  if (!freeUntil || !/^\d{4}-\d{2}-\d{2}$/.test(freeUntil)) return null;
  const end = Date.parse(`${freeUntil}T23:59:59Z`);
  if (Number.isNaN(end) || end - now < 2 * DAY + 3_600_000) return null;
  return Math.floor(end / 1000);
}

const longDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export type BillingState = {
  /** What to say. */
  line: string;
  /** Whether something needs the owner: a failed payment. */
  warn: boolean;
  /** Which button the page leads with. */
  action: 'add' | 'manage';
};

/** The sentence under the price, for where an academy's billing stands today. */
export function billingState(row: BillingRow | null, players: number, now: number): BillingState {
  const owed = `${dollars(monthlyCents(players))} a month for ${players} ${players === 1 ? 'player' : 'players'}`;
  const freeLeft = row?.free_until && Date.parse(`${row.free_until}T23:59:59Z`) > now ? row.free_until : null;

  if (!row || !isLive(row.status)) {
    const was = row?.status === 'canceled' ? 'Billing was cancelled. ' : '';
    if (freeLeft) return { warn: false, action: 'add', line: `${was}Free until ${longDay(freeLeft)}. Add a card any time; it won’t be charged before then.` };
    return { warn: false, action: 'add', line: `${was}No card on file yet.` };
  }
  if (row.status === 'past_due' || row.status === 'unpaid' || row.status === 'incomplete') {
    return { warn: true, action: 'manage', line: 'Your last payment didn’t go through. Update your card to keep things running.' };
  }
  if (row.cancel_at_period_end && row.current_period_end) {
    return { warn: false, action: 'manage', line: `Billing ends on ${longDay(row.current_period_end)}.` };
  }
  if (row.status === 'trialing' && row.trial_end) {
    return { warn: false, action: 'manage', line: `Free until ${longDay(row.trial_end)}. After that, ${owed}.` };
  }
  if (row.current_period_end) {
    return { warn: false, action: 'manage', line: `Next payment on ${longDay(row.current_period_end)}: ${owed}.` };
  }
  return { warn: false, action: 'manage', line: `Card on file. ${owed[0].toUpperCase()}${owed.slice(1)}.` };
}
