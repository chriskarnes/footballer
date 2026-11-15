/**
 * Where the active week stands today: which day it is, which sessions are
 * already done this week, and what's next.
 *
 * Run in the browser, never on the server. "Today" and "this week" are the
 * player's local calendar, and the server's clock is UTC — a Sunday-evening
 * session would land in Monday's week.
 *
 * Framework-free, like the builders.
 */

/** A plan day with just what this needs. 0 = Monday. */
export interface DayRow { weekday: number; slot: number; kind: string; session_id: string | null }

/** A finished library session, as the runner records it. */
export interface Completion { source_ref: string | null; completed_at: string | null }

export const dayKey = (d: { weekday: number; slot: number }) => `${d.weekday}-${d.slot}`;

/** Monday 00:00 of this week, local time. */
function weekStart(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/**
 * Which of a session's days in one week its finishes tick. One finish, one
 * day: its own day first (done on Thursday, Thursday's is done), else the
 * earliest one before it still undone (catching up), else the next one.
 * `days` and `finishes` are weekdays (Monday 0); the answer is indexes into `days`.
 */
export function tickDays(days: number[], finishes: number[]): Set<number> {
  const done = new Set<number>();
  for (const f of [...finishes].sort((a, b) => a - b)) {
    const open = days.map((d, i) => ({ d, i })).filter((x) => !done.has(x.i));
    const pick = open.find((x) => x.d === f) ?? open.find((x) => x.d < f) ?? open[0];
    if (pick) done.add(pick.i);
  }
  return done;
}

export function weekState<T extends DayRow>(days: T[], completions: Completion[], now = new Date()) {
  const today = (now.getDay() + 6) % 7;
  const since = weekStart(now).getTime();

  // Each finish this week ticks one day with that session. A session the plan
  // repeats needs doing twice to tick both. A finish ticks its own day first
  // (done on Thursday, Thursday's card is done), else the earliest one before
  // it still undone (catching up), else the next one.
  const done = new Set<string>();
  const training = days.filter((d) => d.kind !== 'rest' && d.session_id);
  const finishes = completions
    .filter((c) => c.source_ref && c.completed_at && new Date(c.completed_at).getTime() >= since)
    .map((c) => ({ ref: c.source_ref!, weekday: (new Date(c.completed_at!).getDay() + 6) % 7 }))
    .sort((a, b) => a.weekday - b.weekday);
  for (const f of finishes) {
    const open = training.filter((d) => d.session_id === f.ref && !done.has(dayKey(d)));
    const pick = open.find((d) => d.weekday === f.weekday) ?? open.find((d) => d.weekday < f.weekday) ?? open[0];
    if (pick) done.add(dayKey(pick));
  }

  const todays = training.filter((d) => d.weekday === today);
  // What to do next: today's first undone session, else the next training day
  // this week that isn't done. Null when the week is finished.
  const next = training.find((d) => d.weekday >= today && !done.has(dayKey(d))) ?? null;

  return {
    today,
    done,
    todays,
    next,
    doneCount: training.filter((d) => done.has(dayKey(d))).length,
    trainingCount: training.length,
  };
}
