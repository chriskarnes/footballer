/**
 * This week and weeks in a row, from finished sessions.
 *
 * Run in the browser for the same reason as plan-today.ts: "this week" and
 * "yesterday" are the player's local calendar, not the server's UTC.
 *
 * Framework-free, like the builders.
 */

export interface Finished {
  /** When it was finished — completed_at, or created_at for rows from before
   *  the runner recorded it. */
  at: string;
  minutes: number;
  touches: number;
}

const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Monday 00:00 of this week, local time. */
export function weekStart(now: Date): Date {
  const d = dayStart(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** A local calendar day as a sortable key: the time of its midnight. */
const dayKey = (iso: string) => dayStart(new Date(iso)).getTime();

export function thisWeek(finished: Finished[], now = new Date()) {
  const since = weekStart(now).getTime();
  const week = finished.filter((f) => new Date(f.at).getTime() >= since);
  return {
    sessions: week.length,
    minutes: Math.round(week.reduce((a, f) => a + f.minutes, 0)),
    touches: week.reduce((a, f) => a + f.touches, 0),
  };
}

/**
 * Weeks in a row with at least one finished session, up to this one. This
 * week only counts against it once it's over. It was days in a row, which
 * broke on every rest day and game day the week itself plans. The rule is
 * the one the trainer's view of the player uses (progress.ts), so the two
 * say the same number.
 */
export function weeksInARow(finished: Finished[], now = new Date()): number {
  const weeks = new Set(finished.map((f) => weekStart(new Date(f.at)).getTime()));
  const m = weekStart(now);
  if (!weeks.has(m.getTime())) m.setDate(m.getDate() - 7);
  let n = 0;
  while (weeks.has(m.getTime()) && n < 520) { n++; m.setDate(m.getDate() - 7); }
  return n;
}

/** "Today", "Yesterday", a weekday within the week, else a short date. */
export function relativeDay(iso: string, now = new Date()): string {
  const days = Math.round((dayStart(now).getTime() - dayKey(iso)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const d = new Date(iso);
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short',
    ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });
}
