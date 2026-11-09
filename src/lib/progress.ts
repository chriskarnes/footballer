/**
 * How a player is doing, from what the trainer dashboard already has: their
 * active week (plan_days) and the sessions they've finished. Pure, so it can
 * be checked without a database.
 *
 * Weeks run Monday to Sunday in the academy's time zone — the trainer's week,
 * which is the one they talk to players about.
 */

export type PlanDay = { weekday: number; slot: number; kind: string };
export type Done = { at: string; title?: string; minutes?: number | string | null; touches?: number | null };
export type Status = 'good' | 'warn' | 'bad';

export type Progress = {
  status: Status;
  /** Why, in a few words: "On track", "2 behind", "Quiet 12 days". */
  reason: string;
  hasPlan: boolean;
  /** This week: sessions finished, sessions the plan asks for, and how many of those were due by today. */
  done: number; planned: number; due: number;
  daysSince: number | null;
  /** Weeks in a row, up to this one, with at least one session. */
  streak: number;
  /** Monday to Sunday: how many were planned and how many done on each day. */
  week: { date: string; planned: number; done: number; today: boolean; future: boolean }[];
  /** The last four weeks, oldest first, this week last. */
  weeks: { monday: string; done: number; planned: number }[];
  minutesThisWeek: number;
};

/** YYYY-MM-DD for an instant, on the wall calendar of `tz`. */
export function localDate(at: Date | string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(typeof at === 'string' ? new Date(at) : at);
}

const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromUtc(toUtc(d) + n * 86400000);
/** 0 = Monday, as plan_days counts. */
export const weekdayOf = (d: string) => (new Date(toUtc(d)).getUTCDay() + 6) % 7;
export const mondayOf = (d: string) => addDays(d, -weekdayOf(d));
const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / 86400000);

export function progress(input: {
  planDays: PlanDay[]; done: Done[]; lastDone: string | null; now?: Date; tz: string;
}): Progress {
  const { tz } = input;
  const today = localDate(input.now ?? new Date(), tz);
  const monday = mondayOf(today);
  const sessions = input.planDays.filter((d) => d.kind !== 'rest');
  const perWeekday = Array.from({ length: 7 }, (_, i) => sessions.filter((d) => d.weekday === i).length);
  const planned = perWeekday.reduce((a, b) => a + b, 0);
  const hasPlan = planned > 0;

  const doneDates = input.done.map((d) => localDate(d.at, tz));
  const count = (from: string, to: string) => doneDates.filter((d) => d >= from && d <= to).length;

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, planned: perWeekday[i], done: count(date, date), today: date === today, future: date > today };
  });
  const done = count(monday, addDays(monday, 6));
  const due = week.filter((d) => !d.future).reduce((a, d) => a + d.planned, 0);
  const minutesThisWeek = Math.round(input.done
    .filter((d) => localDate(d.at, tz) >= monday)
    .reduce((a, d) => a + (Number(d.minutes) || 0), 0));

  const weeks = [3, 2, 1, 0].map((back) => {
    const m = addDays(monday, -7 * back);
    return { monday: m, done: count(m, addDays(m, 6)), planned };
  });

  let streak = 0;
  for (let back = 0; ; back++) {
    const m = addDays(monday, -7 * back);
    if (count(m, addDays(m, 6))) streak++;
    else if (back === 0) continue; // this week isn't over; don't break the streak for it yet
    else break;
    if (back > 52) break;
  }

  const last = input.lastDone ? localDate(input.lastDone, tz) : null;
  const daysSince = last ? daysBetween(last, today) : null;

  // Silence outranks the plan: a player who hasn't trained in ten days needs a
  // message whatever this week's arithmetic says.
  let status: Status; let reason: string;
  if (daysSince === null) { status = 'bad'; reason = 'Not started'; }
  else if (daysSince >= 10) { status = 'bad'; reason = `Quiet ${daysSince} days`; }
  else if (hasPlan) {
    const behind = due - done;
    if (behind >= 2) { status = 'bad'; reason = `${behind} behind`; }
    else if (behind === 1) { status = 'warn'; reason = '1 behind'; }
    else { status = 'good'; reason = done > planned ? 'Ahead' : 'On track'; }
  } else if (daysSince <= 3) { status = 'good'; reason = 'Active'; }
  else { status = 'warn'; reason = `Quiet ${daysSince} days`; }

  return { status, reason, hasPlan, done, planned, due, daysSince, streak, week, weeks, minutesThisWeek };
}

/** "today", "yesterday", "3 days ago", "never". */
export function sinceLabel(days: number | null): string {
  if (days === null) return 'never';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** Worst first, then the longest silence, then by name. */
export function byAttention<T extends { progress: Progress; name: string }>(a: T, b: T) {
  const rank = { bad: 0, warn: 1, good: 2 };
  return rank[a.progress.status] - rank[b.progress.status]
    || (b.progress.daysSince ?? 1e9) - (a.progress.daysSince ?? 1e9)
    || a.name.localeCompare(b.name);
}
