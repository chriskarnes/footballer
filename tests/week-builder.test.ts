import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerWeek, type PastWeek } from '../src/lib/week-builder';

const drills = Array.from({ length: 12 }, (_, i) => ({
  id: `d${i}`, name: `Drill ${i}`, amount: '3 x 10', minutes: 10, focus: 'first_touch', focus_areas: ['first_touch'], video_url: null, how: null,
}));
const NEXT = '2026-11-16', THIS = '2026-11-09';
const input = { drills, target: { sessions: 3, minutes: 30 }, focus: ['first_touch'], seed: 'u1', weekOf: NEXT };
const session = (ids: string[], done: boolean, open?: boolean) =>
  ({ drill_ids: ids, steps: ids.map(() => 0), done, feel: done ? 'right' as const : null, ticked: null, open });
const stepOf = (week: ReturnType<typeof buildPlayerWeek>, id: string) => {
  for (const s of week) { const k = s.drill_ids.indexOf(id); if (k >= 0) return { step: s.steps[k], change: s.changes[k] }; }
  return null;
};
const ups = (week: ReturnType<typeof buildPlayerWeek>) => week.flatMap((s) => s.changes).filter((c) => c === 'up').length;

// Tuesday: one of this week's three done, the other two set for later in
// the week. Next week built now read that as one of three, "struggling",
// and nothing stepped up.
test('next week built early doesn’t count sessions still to come as skipped', () => {
  const history: PastWeek[] = [{ week_of: THIS, light: false, sessions: [
    session(['d0', 'd1', 'd2'], true), session(['d3', 'd4', 'd5'], false, true), session(['d6', 'd7', 'd8'], false, true),
  ] }];
  const week = buildPlayerWeek({ ...input, history });
  assert.ok(ups(week) > 0, 'what they did well steps up');
  for (const id of ['d0', 'd1', 'd2']) {
    const s = stepOf(week, id);
    if (s) assert.deepEqual(s, { step: 1, change: 'up' }, `${id} was done, so it steps up`);
  }
  // Not done yet isn't done: those hold where they are.
  for (const id of ['d3', 'd4', 'd5', 'd6', 'd7', 'd8']) {
    const s = stepOf(week, id);
    if (s) assert.equal(s.step, 0, `${id} hasn't been done, so it doesn't step up`);
  }
});

test('a week that’s over, with one of three done, still eases off', () => {
  const history: PastWeek[] = [{ week_of: THIS, light: false, sessions: [
    session(['d0', 'd1', 'd2'], true), session(['d3', 'd4', 'd5'], false, false), session(['d6', 'd7', 'd8'], false),
  ] }];
  assert.equal(ups(buildPlayerWeek({ ...input, history })), 0);
});

test('sessions whose day has gone still count as skipped in a week under way', () => {
  // Thursday: Monday's and Tuesday's missed, Friday's still to come.
  const history: PastWeek[] = [{ week_of: THIS, light: false, sessions: [
    session(['d0', 'd1', 'd2'], false, false), session(['d3', 'd4', 'd5'], false, false), session(['d6', 'd7', 'd8'], false, true),
  ] }];
  assert.equal(ups(buildPlayerWeek({ ...input, history })), 0);
});

// The trainer set these by hand to Level 6 (step 5), past the last step the
// rules give. Done well, they dropped back to Level 4.
test('a level set by hand above the top isn’t taken back down for doing it well', () => {
  const history: PastWeek[] = [{ week_of: THIS, light: false, sessions: [
    { drill_ids: ['d0', 'd1'], steps: [5, 5], done: true, feel: 'right', ticked: null },
    { drill_ids: ['d2', 'd3'], steps: [5, 5], done: true, feel: 'right', ticked: null },
  ] }];
  const week = buildPlayerWeek({ ...input, history });
  const kept = ['d0', 'd1', 'd2', 'd3'].map((id) => stepOf(week, id)).filter(Boolean);
  assert.ok(kept.length > 0, 'some of last week’s drills are kept');
  for (const k of kept) assert.equal(k!.step, 5);
});
