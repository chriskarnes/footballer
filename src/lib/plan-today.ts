/**
 * Where a followed week stands today: which day it is, which sessions are
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

export function weekState<T extends DayRow>(days: T[], completions: Completion[], now = new Date()) {
  const today = (now.getDay() + 6) % 7;
  const since = weekStart(now).getTime();

  // How many times each session was finished this week. A session the plan
  // repeats needs doing twice to tick both days, and they tick in order.
  const finished = new Map<string, number>();
  for (const c of completions) {
    if (!c.source_ref || !c.completed_at) continue;
    if (new Date(c.completed_at).getTime() < since) continue;
    finished.set(c.source_ref, (finished.get(c.source_ref) ?? 0) + 1);
  }

  const done = new Set<string>();
  const training = days.filter((d) => d.kind !== 'rest' && d.session_id);
  for (const d of training) {
    const left = finished.get(d.session_id!) ?? 0;
    if (left > 0) { done.add(dayKey(d)); finished.set(d.session_id!, left - 1); }
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
