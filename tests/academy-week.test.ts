import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeek, placeDays } from '../src/lib/academy-week';

// Monday 2026-11-09 to Sunday 2026-11-15.
const MON = '2026-11-09', THU = '2026-11-12';
const program = { id: 'p1', name: 'Touch', weeks: 8 };
const sessions = [0, 1, 2].map((i) => ({ id: `s${i}`, program_id: 'p1', week: 1, position: i, name: `S${i}`, drill_ids: ['d1'] }));
const drills = [{ id: 'd1', name: 'D', amount: null, minutes: 10, focus: null, video_url: null, how: null }];
const base = {
  userId: 'u1', tz: 'America/New_York', programs: [program], sessions, drills,
  playerPrograms: [], addons: [], completions: [],
};
const group = (starts_on: string) => [{ id: 'g1', name: 'U12', meets_weekday: null, meets_time: null, program_id: 'p1', starts_on }];
const days = (items: { weekday: number }[]) => items.map((i) => i.weekday).sort((a, b) => a - b);

test('a week under way from Monday is spread across the week, as before', () => {
  const w = buildWeek({ ...base, today: THU, groups: group(MON), memberships: [{ group_id: 'g1', user_id: 'u1', added_at: '2026-11-02T15:00:00Z' }] });
  assert.equal(w.length, 3);
  assert.ok(days(w)[0] < 3, 'some sessions sit early in the week');
});

// Added on Thursday, the player read "2 behind" and "Missed Monday" at once.
test('a player added to a group on Thursday has no sessions on days already gone', () => {
  const w = buildWeek({ ...base, today: THU, groups: group('2026-10-26'), memberships: [{ group_id: 'g1', user_id: 'u1', added_at: '2026-11-12T15:00:00Z' }] });
  assert.equal(w.length, 3);
  assert.ok(days(w).every((d) => d >= 3), `all from Thursday on, got ${days(w)}`);
});

test('a program started on Thursday starts on Thursday', () => {
  const w = buildWeek({ ...base, today: THU, groups: [], memberships: [], playerPrograms: [{ user_id: 'u1', program_id: 'p1', starts_on: THU }] });
  assert.ok(days(w).every((d) => d >= 3), `got ${days(w)}`);
});

test('the days don’t shift as that first week goes on, and the next week is a whole one', () => {
  const at = (today: string) => days(buildWeek({ ...base, today, groups: group(THU), memberships: [{ group_id: 'g1', user_id: 'u1', added_at: '2026-11-12T15:00:00Z' }] }));
  assert.deepEqual(at('2026-11-12'), at('2026-11-15'));
  assert.ok(at('2026-11-16')[0] < 3, 'week two uses the whole week');
});

test('the day they were added is the academy’s day, not UTC’s', () => {
  // 01:00 UTC on Friday is still Thursday evening in New York.
  const w = buildWeek({ ...base, today: THU, groups: group('2026-10-26'), memberships: [{ group_id: 'g1', user_id: 'u1', added_at: '2026-11-13T01:00:00Z' }] });
  assert.equal(days(w)[0], 3);
});

test('without an added date (an older calendar feed) nothing changes', () => {
  const w = buildWeek({ ...base, today: THU, groups: group('2026-10-26'), memberships: [{ group_id: 'g1', user_id: 'u1' }] });
  assert.ok(days(w)[0] < 3);
});

test('placeDays always hands back real days, however little room there is', () => {
  for (let count = 1; count <= 8; count++) for (let from = 0; from <= 6; from++) {
    for (const done of [[], [from], [0, 1, 2, 3, 4, 5, 6]]) {
      const out = placeDays(count, { from, done, games: [5], practice: [1, 3] });
      assert.equal(out.length, count);
      assert.ok(out.every((d) => Number.isInteger(d) && d >= 0 && d <= 6), `count ${count} from ${from} done ${done}: ${out}`);
      assert.ok(out.every((d) => d >= from), `nothing before day ${from}: ${out}`);
    }
  }
});

// Back to their program on Thursday, with two of the week's built sessions
// already done. They were deleted, and "2 of 3" dropped to "0 of 3".
test('going back to the program keeps what was done, and gives the rest from that day', () => {
  const custom = [0, 1, 2].map((i) => ({ id: `c${i}`, user_id: 'u1', week_of: MON, position: i, name: `Built ${i}`, drill_ids: ['d1'], weekday: i, made_by: 'rules' as const }));
  const completions = [
    { source: 'academy', source_ref: 'c0', completed_at: '2026-11-09T20:00:00Z' },
    { source: 'academy', source_ref: 'c1', completed_at: '2026-11-10T20:00:00Z' },
  ];
  const w = buildWeek({
    ...base, today: THU, groups: group('2026-10-26'), memberships: [{ group_id: 'g1', user_id: 'u1', added_at: '2026-10-26T15:00:00Z' }],
    // Only the done two are left once it goes back.
    custom: custom.slice(0, 2), completions,
    plans: [{ user_id: 'u1', mode: 'program', program_from: THU }],
  });
  const built = w.filter((i) => i.kind === 'custom'), program = w.filter((i) => i.kind === 'session');
  assert.equal(built.length, 2);
  assert.ok(built.every((i) => i.done), 'the built sessions still read done');
  assert.equal(program.length, 1, 'the program gives the one still owed');
  assert.ok(program.every((i) => i.weekday >= 3), `on a day still to come, got ${days(program)}`);
  assert.equal(w.filter((i) => i.done).length, 2);
});

test('a custom week still takes the program’s place', () => {
  const custom = [0, 1].map((i) => ({ id: `c${i}`, user_id: 'u1', week_of: MON, position: i, name: `Built ${i}`, drill_ids: ['d1'], weekday: i + 3, made_by: 'rules' as const }));
  const w = buildWeek({ ...base, today: THU, groups: group('2026-10-26'), memberships: [{ group_id: 'g1', user_id: 'u1' }], custom, plans: [{ user_id: 'u1', mode: 'custom' }] });
  assert.deepEqual(w.map((i) => i.kind), ['custom', 'custom']);
});
