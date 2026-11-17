import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billingState, dollars, isLive, monthlyCents, trialEndFor, type BillingRow } from '../src/lib/billing';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const row = (patch: Partial<BillingRow>): BillingRow => ({
  stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active', quantity: 3,
  current_period_end: '2026-12-01T00:00:00Z', trial_end: null, cancel_at_period_end: false, free_until: null, ...patch,
});

test('five dollars a player', () => {
  assert.equal(monthlyCents(0), 0);
  assert.equal(monthlyCents(15), 7500);
  assert.equal(monthlyCents(-2), 0);
  assert.equal(dollars(7500), '$75');
  assert.equal(dollars(550), '$5.50');
});

test('a card added in free time is never charged before it ends', () => {
  assert.equal(trialEndFor(null, NOW), null);
  assert.equal(trialEndFor('not a date', NOW), null);
  assert.equal(trialEndFor('2026-11-10', NOW), null, 'already over');
  assert.equal(trialEndFor('2027-01-14', NOW), Date.parse('2027-01-14T23:59:59Z') / 1000);
  // Under two days left: Stripe won't take a free period that short, so the
  // first payment is put two days out. Later than the free day, not sooner.
  const soon = new Date(NOW + 20 * 3_600_000).toISOString().slice(0, 10);
  const end = trialEndFor(soon, NOW);
  assert.ok(end !== null && end * 1000 >= Date.parse(`${soon}T23:59:59Z`), 'not before the free day ends');
  assert.ok(end !== null && end * 1000 - NOW >= 2 * 86_400_000, 'at least the two days Stripe needs');
});

test('a cancelled or expired subscription is not live', () => {
  assert.equal(isLive(null), false);
  assert.equal(isLive('canceled'), false);
  assert.equal(isLive('incomplete_expired'), false);
  assert.equal(isLive('trialing'), true);
  assert.equal(isLive('past_due'), true);
});

test('no card yet', () => {
  const s = billingState(null, 4, NOW);
  assert.equal(s.action, 'add');
  assert.match(s.line, /No card on file/);
});

test('free time with no card says when it ends', () => {
  const s = billingState(row({ stripe_subscription_id: null, status: null, free_until: '2027-01-14' }), 4, NOW);
  assert.equal(s.action, 'add');
  assert.match(s.line, /Free until January 14, 2027/);
});

test('free time that has passed is not mentioned', () => {
  const s = billingState(row({ stripe_subscription_id: null, status: null, free_until: '2026-11-01' }), 4, NOW);
  assert.match(s.line, /No card on file/);
});

test('a trial says what comes after it', () => {
  const s = billingState(row({ status: 'trialing', trial_end: '2027-01-14T23:59:59Z' }), 15, NOW);
  assert.equal(s.action, 'manage');
  assert.match(s.line, /Free until January 14, 2027\. After that, \$75 a month for 15 players\./);
});

test('an active subscription gives the next payment, for the players there now', () => {
  const s = billingState(row({}), 1, NOW);
  assert.match(s.line, /Next payment on December 1, 2026: \$5 a month for 1 player\./);
  assert.equal(s.warn, false);
});

test('a failed payment is a warning', () => {
  const s = billingState(row({ status: 'past_due' }), 3, NOW);
  assert.equal(s.warn, true);
  assert.equal(s.action, 'manage');
});

test('a subscription set to end says when', () => {
  const s = billingState(row({ cancel_at_period_end: true }), 3, NOW);
  assert.match(s.line, /Billing ends on December 1, 2026/);
});

test('a cancelled subscription offers a card again', () => {
  const s = billingState(row({ status: 'canceled' }), 3, NOW);
  assert.equal(s.action, 'add');
  assert.match(s.line, /Billing was cancelled/);
});
