import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tickDays } from '../src/lib/plan-today';
import { feedEvents } from '../src/lib/calendar-feed';
import { mailtoAddr } from '../src/lib/mailto';
import { RESERVED_SLUGS, slugFree } from '../src/lib/tenant';
import { sessionsForWeek } from '../src/lib/academy-week';
import { buildPlayerWeek } from '../src/lib/week-builder';
import { cleanProposed } from '../src/lib/ai-name';

test('one finish ticks one day: its own, else an earlier one, else the next', () => {
  assert.deepEqual([...tickDays([1, 4], [4])], [1]);
  assert.deepEqual([...tickDays([1, 4], [2])], [0]);
  assert.deepEqual([...tickDays([3, 5], [0])], [0]);
  assert.deepEqual([...tickDays([1, 4], [1, 4])].sort(), [0, 1]);
  assert.deepEqual([...tickDays([1, 4], [])], []);
});

// The same session on Tuesday and Friday, done once: the calendar ticked both.
test('the calendar ticks a repeated plan session once per finish, as Plan does', () => {
  const now = new Date('2026-11-11T17:00:00Z');   // a Wednesday
  const events = feedEvents({
    include_plan: true, include_speed: false, start_time: null, time_zone: 'UTC', speed_year: null,
    plan_days: [{ weekday: 1, slot: 0, kind: 'technical', session_id: 's1' }, { weekday: 4, slot: 0, kind: 'technical', session_id: 's1' }],
    completed: [{ source: 'library', source_ref: 's1', completed_at: '2026-11-10T18:00:00Z' }],
  } as never, [{ id: 's1', name: 'Touch', total_minutes: 20 }] as never, 'https://x.test', now);
  const week = events.filter((e) => e.date >= '2026-11-09' && e.date <= '2026-11-15');
  assert.equal(week.length, 2);
  assert.deepEqual(week.map((e) => e.summary.startsWith('✓')), [true, false]);
});

test('an address in a mailto link can’t add fields to the draft', () => {
  assert.equal(mailtoAddr('mike+club@x.com'), 'mike+club@x.com');
  assert.equal(mailtoAddr('mike@x.com?bcc=me@evil.com&x='), 'mike@x.com%3Fbcc%3Dme@evil.com%26x%3D');
});

test('addresses kept for the site aren’t free to ask for', () => {
  for (const s of ['coach', 'admin', 'play', 'www']) assert.equal(slugFree(s), false);
  assert.equal(slugFree('mikes-academy'), true);
  assert.equal(slugFree('a'), false);
  assert.ok(RESERVED_SLUGS.has('api'));
});

test('two sessions at one position keep one order', () => {
  const s = (id: string, position: number) => ({ id, program_id: 'p', week: 1, position, name: id, drill_ids: [] });
  const a = sessionsForWeek([s('b', 2), s('a', 2), s('c', 0)], 'p', 1).map((x) => x.id);
  const b = sessionsForWeek([s('a', 2), s('c', 0), s('b', 2)], 'p', 1).map((x) => x.id);
  assert.deepEqual(a, ['c', 'a', 'b']);
  assert.deepEqual(b, a);
});

test('drills already done this week aren’t picked again in a rebuild', () => {
  const drills = Array.from({ length: 12 }, (_, i) => ({ id: `d${i}`, name: `D${i}`, amount: null, minutes: 10, focus: 'passing', focus_areas: ['passing'], video_url: null, how: null }));
  const taken = ['d0', 'd1', 'd2'];
  for (const seed of ['a', 'b', 'c', 'd']) {
    const week = buildPlayerWeek({ drills, target: { sessions: 2, minutes: 30 }, focus: ['passing'], seed, taken });
    assert.ok(week.length > 0);
    assert.ok(week.every((s) => s.drill_ids.every((id) => !taken.includes(id))), `seed ${seed}`);
  }
});

test('an AI session that isn’t the shape asked for is left out, not passed on', () => {
  assert.equal(cleanProposed({ name: 5, new_drill_ids: 'd1' }, 'Sam'), null);
  assert.equal(cleanProposed(null, 'Sam'), null);
  assert.deepEqual(cleanProposed({ name: 'Touch', new_drill_ids: ['d1', 7], note: '{name}, go.' }, 'Sam'), { name: 'Touch', new_drill_ids: ['d1'], note: 'Sam, go.' });
});
