import { test } from 'node:test';
import assert from 'node:assert/strict';
import { myProgress } from '../src/lib/my-progress';

const now = new Date('2026-11-18T18:00:00Z'); // a Wednesday

test('counts this week, the run of weeks, and everything so far', () => {
  const p = myProgress([
    { at: '2026-11-17T20:00:00Z', touches: 500 },
    { at: '2026-11-16T20:00:00Z', touches: 300 },
    { at: '2026-11-11T20:00:00Z', touches: 200 },
    { at: '2026-11-03T20:00:00Z', touches: 0 },
    { at: '2026-10-13T20:00:00Z', touches: 100 },
  ], 'UTC', now);
  assert.deepEqual(p, { thisWeek: 2, weeks: 3, sessions: 5, touches: 1100 });
});

test('a week not yet started does not break the run', () => {
  const p = myProgress([{ at: '2026-11-12T20:00:00Z', touches: 0 }, { at: '2026-11-05T20:00:00Z', touches: 0 }], 'UTC', now);
  assert.equal(p.thisWeek, 0);
  assert.equal(p.weeks, 2);
});

test('a missed week ends it, and nothing done is nothing', () => {
  assert.equal(myProgress([{ at: '2026-11-03T20:00:00Z', touches: 0 }], 'UTC', now).weeks, 0);
  assert.deepEqual(myProgress([], 'UTC', now), { thisWeek: 0, weeks: 0, sessions: 0, touches: 0 });
});
