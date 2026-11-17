import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountLabel, drillName } from '../src/lib/drill-copy';

test('a name in capitals reads in title case; others are left alone', () => {
  assert.equal(drillName('JUGGLING WITH ONE BOUNCE'), 'Juggling with One Bounce');
  assert.equal(drillName('FRONT POST CROSS (R)'), 'Front Post Cross (R)');
  assert.equal(drillName('1V1 TO GOAL'), '1v1 to Goal');
  assert.equal(drillName('Toe taps'), 'Toe taps');
  assert.equal(drillName('A-skip'), 'A-skip');
});

test('amounts read as words', () => {
  assert.equal(amountLabel('1', '250-500'), '250 to 500 reps');
  assert.equal(amountLabel('3', '30s'), '3 rounds of 30 seconds');
  assert.equal(amountLabel('2-3', '6'), '2 to 3 rounds of 6');
  assert.equal(amountLabel('1', '50 BOTH FEET'), '50 both feet');
  assert.equal(amountLabel('2', '20M'), '2 rounds of 20 m');
  assert.equal(amountLabel('3', '3 × 20, each foot'), '3 rounds of 3 × 20, each foot');
  assert.equal(amountLabel('1', '1'), '1 rep');
  assert.equal(amountLabel('', ''), '');
});
