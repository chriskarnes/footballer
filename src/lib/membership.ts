/**
 * Families pay (0038), the parts with no Stripe in them: what an academy
 * charges, whether a player may train today, and what to tell them about it.
 * Stripe itself is in billing-server.ts.
 */
import { dollars, isLive } from './billing';

export const DEFAULT_PLAYER_PRICE_CENTS = 1000;
export const DEFAULT_TRIAL_DAYS = 7;

/** What an academy charges, as academy_terms() gives it. */
export type Terms = {
  /** none (0040): nobody is billed here. */
  mode: 'trainer_pays' | 'players_pay' | 'none';
  priceCents: number;
  trialDays: number;
  /** When families started paying here: nobody's free days begin before it. */
  since: string | null;
};

export type PlayerBillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
};

export const PLAYER_BILLING_COLUMNS =
  'stripe_customer_id, stripe_subscription_id, status, current_period_end, trial_end, cancel_at_period_end';

export function toTerms(raw: unknown): Terms | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  // Number(null) is 0, which would read as "no free days": nothing is nothing.
  const price = r.price_cents == null ? NaN : Number(r.price_cents);
  const days = r.trial_days == null ? NaN : Number(r.trial_days);
  return {
    mode: r.mode === 'players_pay' ? 'players_pay' : r.mode === 'none' ? 'none' : 'trainer_pays',
    priceCents: Number.isFinite(price) && price > 0 ? price : DEFAULT_PLAYER_PRICE_CENTS,
    trialDays: Number.isFinite(days) && days >= 0 ? days : DEFAULT_TRIAL_DAYS,
    since: typeof r.since === 'string' ? r.since : null,
  };
}

const DAY = 86_400_000;

/** When a player's free days end: counted from joining, or from when families started paying here if that's later. */
export function freeUntil(terms: Terms, joinedAt: string | null | undefined): number {
  const joined = Date.parse(joinedAt ?? '');
  const since = Date.parse(terms.since ?? '');
  const from = Math.max(Number.isNaN(joined) ? 0 : joined, Number.isNaN(since) ? 0 : since);
  return from + terms.trialDays * DAY;
}

export type Access = {
  /**
   * not_needed  the trainer pays here, or this person is staff
   * trial       inside their free days, no card yet
   * paid        a card on file and Stripe is happy (or still in its own trial)
   * past_due    the last payment failed and Stripe is retrying: still let in
   * locked      free days over and no live subscription
   * paused      switched off by their trainer (0040): on the roster, not
   *             training, and nobody is charged for them
   */
  state: 'not_needed' | 'trial' | 'paid' | 'past_due' | 'locked' | 'paused';
  /** When the free days end, as a time; null where it doesn't apply. */
  freeUntil: number | null;
  /** Whole days of free time left, rounded up; 0 where it doesn't apply. */
  daysLeft: number;
};

/** Whether a player may train today. */
export function playerAccess(terms: Terms | null, joinedAt: string | null | undefined, row: PlayerBillingRow | null, now: number, active = true): Access {
  // Whoever pays: a player their trainer has switched off doesn't train.
  if (!active) return { state: 'paused', freeUntil: null, daysLeft: 0 };
  if (!terms || terms.mode !== 'players_pay') return { state: 'not_needed', freeUntil: null, daysLeft: 0 };
  const until = freeUntil(terms, joinedAt);
  const left = Math.max(0, Math.ceil((until - now) / DAY));
  if (row && isLive(row.status)) {
    if (row.status === 'active' || row.status === 'trialing') return { state: 'paid', freeUntil: until, daysLeft: left };
    if (row.status === 'past_due') return { state: 'past_due', freeUntil: until, daysLeft: left };
  }
  // Free days are for before the first card. Once a family has subscribed and
  // stopped, leaving and joining again doesn't start them over.
  if (row?.stripe_subscription_id) return { state: 'locked', freeUntil: until, daysLeft: 0 };
  if (now < until) return { state: 'trial', freeUntil: until, daysLeft: left };
  return { state: 'locked', freeUntil: until, daysLeft: 0 };
}

/**
 * The free time a new subscription carries, in Unix seconds, or null. A card
 * added during the free days isn't charged until they end. Stripe wants a
 * trial's end at least two days out, so with less than that left the first
 * payment is taken when the card is added.
 */
export function subscriptionTrialEnd(until: number | null, now: number): number | null {
  if (!until || until - now < 2 * DAY + 3_600_000) return null;
  return Math.floor(until / 1000);
}

const longDay = (ms: number | string) =>
  new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

/** The sentence a family reads about where their membership stands. */
export function membershipLine(terms: Terms, access: Access, row: PlayerBillingRow | null): string {
  const price = `${dollars(terms.priceCents)} a month`;
  switch (access.state) {
    case 'not_needed': return 'There’s nothing to pay here.';
    case 'paused': return 'Your trainer has paused your training here. Nothing is being charged. Ask them to switch it back on.';
    case 'trial': return `Free until ${longDay(access.freeUntil!)}. After that it’s ${price}. Add a card any time; it won’t be charged before then.`;
    case 'locked': return row?.status === 'canceled'
      ? `Your membership ended. It’s ${price} to start training again.`
      : `Your free days are over. It’s ${price} to keep training.`;
    case 'past_due': return 'Your last payment didn’t go through. Update your card to keep training.';
    case 'paid':
      if (row?.cancel_at_period_end && row.current_period_end) return `Your membership ends on ${longDay(row.current_period_end)}.`;
      if (row?.status === 'trialing' && row.trial_end) return `Free until ${longDay(row.trial_end)}, then ${price}.`;
      if (row?.current_period_end) return `${price[0].toUpperCase()}${price.slice(1)}. Next payment on ${longDay(row.current_period_end)}.`;
      return `${price[0].toUpperCase()}${price.slice(1)}.`;
  }
}

/** One word for a trainer's list of who is paying. */
export function accessLabel(a: Access): string {
  return a.state === 'paid' ? 'Paying'
    : a.state === 'past_due' ? 'Payment failed'
    : a.state === 'trial' ? `Free, ${a.daysLeft} ${a.daysLeft === 1 ? 'day' : 'days'} left`
    : a.state === 'locked' ? 'Not paying'
    : a.state === 'paused' ? 'Inactive'
    : '';
}
