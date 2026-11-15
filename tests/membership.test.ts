import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessLabel, freeUntil, membershipLine, playerAccess, subscriptionTrialEnd, toTerms, type PlayerBillingRow, type Terms } from '../src/lib/membership';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const DAY = 86_400_000;
const terms = (patch: Partial<Terms> = {}): Terms => ({ mode: 'players_pay', priceCents: 1000, trialDays: 14, since: null, ...patch });
const row = (patch: Partial<PlayerBillingRow> = {}): PlayerBillingRow => ({
  stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active',
  current_period_end: '2026-12-10T00:00:00Z', trial_end: null, cancel_at_period_end: false, ...patch,
});

test('terms read what the database gives, with $10 and 14 days when it gives nothing usable', () => {
  assert.equal(toTerms(null), null);
  assert.deepEqual(toTerms({ mode: 'players_pay', price_cents: 1500, trial_days: 90, since: '2026-11-01T00:00:00Z' }),
    { mode: 'players_pay', priceCents: 1500, trialDays: 90, since: '2026-11-01T00:00:00Z' });
  assert.deepEqual(toTerms({ mode: 'anything', price_cents: null, trial_days: null }),
    { mode: 'trainer_pays', priceCents: 1000, trialDays: 14, since: null });
});

test('where the trainer pays, a player is never asked', () => {
  assert.equal(playerAccess(terms({ mode: 'trainer_pays' }), '2020-01-01T00:00:00Z', null, NOW).state, 'not_needed');
  assert.equal(playerAccess(null, '2020-01-01T00:00:00Z', null, NOW).state, 'not_needed');
});

test('free days count from joining', () => {
  const joined = new Date(NOW - 3 * DAY).toISOString();
  const a = playerAccess(terms(), joined, null, NOW);
  assert.equal(a.state, 'trial');
  assert.equal(a.daysLeft, 11);
});

test('someone already here gets their free days from when families started paying', () => {
  const t = terms({ since: new Date(NOW - 2 * DAY).toISOString() });
  assert.equal(freeUntil(t, '2025-01-01T00:00:00Z'), NOW + 12 * DAY);
  assert.equal(playerAccess(t, '2025-01-01T00:00:00Z', null, NOW).state, 'trial');
});

test('free days over and no card: locked', () => {
  const a = playerAccess(terms(), new Date(NOW - 20 * DAY).toISOString(), null, NOW);
  assert.equal(a.state, 'locked');
  assert.equal(a.daysLeft, 0);
});

test('a longer free period keeps a founding trainer’s players in', () => {
  const a = playerAccess(terms({ trialDays: 90 }), new Date(NOW - 20 * DAY).toISOString(), null, NOW);
  assert.equal(a.state, 'trial');
  assert.equal(a.daysLeft, 70);
});

test('a live subscription is paid, whatever the free days say', () => {
  const old = new Date(NOW - 200 * DAY).toISOString();
  assert.equal(playerAccess(terms(), old, row(), NOW).state, 'paid');
  assert.equal(playerAccess(terms(), old, row({ status: 'trialing' }), NOW).state, 'paid');
});

test('a failed payment still lets them in while Stripe retries', () => {
  assert.equal(playerAccess(terms(), new Date(NOW - 200 * DAY).toISOString(), row({ status: 'past_due' }), NOW).state, 'past_due');
});

test('a cancelled, unpaid or unfinished subscription is locked, and free days don’t start over', () => {
  const old = new Date(NOW - 200 * DAY).toISOString();
  for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
    assert.equal(playerAccess(terms(), old, row({ status }), NOW).state, 'locked', status);
  }
  assert.equal(playerAccess(terms(), new Date(NOW - DAY).toISOString(), row({ status: 'canceled' }), NOW).state, 'locked');
  // A checkout that was opened and never finished has no subscription: still free.
  assert.equal(playerAccess(terms(), new Date(NOW - DAY).toISOString(), row({ status: null, stripe_subscription_id: null }), NOW).state, 'trial');
});

test('a card added in the free days is charged when they end, unless that is under two days away', () => {
  assert.equal(subscriptionTrialEnd(null, NOW), null);
  assert.equal(subscriptionTrialEnd(NOW - DAY, NOW), null);
  assert.equal(subscriptionTrialEnd(NOW + DAY, NOW), null);
  assert.equal(subscriptionTrialEnd(NOW + 10 * DAY, NOW), Math.floor((NOW + 10 * DAY) / 1000));
});

test('what a family is told', () => {
  const t = terms();
  const trial = playerAccess(t, new Date(NOW - 3 * DAY).toISOString(), null, NOW);
  assert.match(membershipLine(t, trial, null), /Free until November 26\. After that it’s \$10 a month/);
  const locked = playerAccess(t, new Date(NOW - 30 * DAY).toISOString(), null, NOW);
  assert.match(membershipLine(t, locked, null), /free days are over\. It’s \$10 a month/);
  assert.match(membershipLine(t, locked, row({ status: 'canceled' })), /membership ended/);
  const paid = playerAccess(t, new Date(NOW - 30 * DAY).toISOString(), row(), NOW);
  assert.match(membershipLine(t, paid, row()), /\$10 a month\. Next payment on December 10/);
  assert.match(membershipLine(t, paid, row({ cancel_at_period_end: true })), /ends on December 10/);
  assert.match(membershipLine(terms({ priceCents: 1250 }), locked, null), /\$12\.50 a month/);
});

test('what a trainer sees beside each player', () => {
  const t = terms();
  assert.equal(accessLabel(playerAccess(t, new Date(NOW - 13 * DAY).toISOString(), null, NOW)), 'Free, 1 day left');
  assert.equal(accessLabel(playerAccess(t, new Date(NOW - 30 * DAY).toISOString(), null, NOW)), 'Not paying');
  assert.equal(accessLabel(playerAccess(t, null, row(), NOW)), 'Paying');
});
