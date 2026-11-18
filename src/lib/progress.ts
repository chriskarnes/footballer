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
  /** Why, in a few words: "On track", "Missed 2 sessions", "No training in 12 days". */
  reason: string;
  hasPlan: boolean;
  /** This week: sessions finished, sessions the plan asks for, and how many of those were due by today. */
  done: number; planned: number; due: number;
  daysSince: number | null;
  /** Weeks in a row, up to this one, with at least one session. */
  streak: number;
  /** Monday to Sunday: how many were planned and how many done on each day. */
  /** `covered`: that day's set sessions done, whichever day they were done
   *  on. A day is missed only when some of its sessions still aren't. */
  week: { date: string; planned: number; done: number; covered: number; today: boolean; future: boolean }[];
  /** The last four weeks, oldest first, this week last: sessions of any kind.
   *  Planned for this week only: what was set for past weeks isn't kept. */
  weeks: { monday: string; done: number; planned: number | null }[];
  /** The streak reached the start of what was read: it may be longer. */
  streakAtLeast: boolean;
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
  /** This week's set sessions done, by the weekday each was done: the same
   *  count the player's Train shows. Without it, every finished workout. */
  setDone?: number[];
  /** The same sessions, by the weekday each was set for. */
  setCovered?: number[];
  /** Where `done` starts (YYYY-MM-DD), so a streak that reaches it reads "at least". */
  since?: string;
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

  // "x of y" counts the week's set sessions, as the player sees them: Speed,
  // free sessions and extras are training, but not what was set.
  const set = input.setDone;
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const done = set ? set.filter((d) => d === i).length : count(date, date);
    const covered = input.setCovered ? input.setCovered.filter((d) => d === i).length : done;
    return { date, planned: perWeekday[i], done, covered, today: date === today, future: date > today };
  });
  const done = set ? set.length : count(monday, addDays(monday, 6));
  const due = week.filter((d) => !d.future).reduce((a, d) => a + d.planned, 0);
  const minutesThisWeek = Math.round(input.done
    .filter((d) => localDate(d.at, tz) >= monday)
    .reduce((a, d) => a + (Number(d.minutes) || 0), 0));

  const weeks = [3, 2, 1, 0].map((back) => {
    const m = addDays(monday, -7 * back);
    return { monday: m, done: count(m, addDays(m, 6)), planned: back === 0 ? planned : null };
  });

  let streak = 0, streakAtLeast = false;
  for (let back = 0; ; back++) {
    const m = addDays(monday, -7 * back);
    // Read back to the start of what we have: past it, unknown, not a gap.
    if (input.since && m < input.since) { streakAtLeast = true; break; }
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
  // The words are a trainer's, not a dashboard's: "Missed 2 sessions", not
  // "2 behind". Ahead of the plan is on track too; a trainer acts on neither.
  // With no plan it's "Training", not "Active": Active is the word for a
  // player who is switched on (0040), and the two sat side by side.
  if (daysSince === null) { status = 'bad'; reason = 'Hasn’t started'; }
  else if (daysSince >= 10) { status = 'bad'; reason = `No training in ${daysSince} days`; }
  else if (hasPlan) {
    const behind = due - done;
    if (behind >= 2) { status = 'bad'; reason = `Missed ${behind} sessions`; }
    else if (behind === 1) { status = 'warn'; reason = 'Missed 1 session'; }
    else { status = 'good'; reason = 'On track'; }
  } else if (daysSince <= 3) { status = 'good'; reason = 'Training'; }
  else { status = 'warn'; reason = `No training in ${daysSince} days`; }

  return { status, reason, hasPlan, done, planned, due, daysSince, streak, streakAtLeast, week, weeks, minutesThisWeek };
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

/**
 * The second line under a player's name: the week's count, or when they last
 * trained — whichever the reason doesn't already say. "No training in 13
 * days" needs nothing after it; "On track" needs the count.
 */
export function detailOf(p: Progress): string | null {
  if (p.daysSince === null || p.daysSince >= 10) return null;
  if (p.hasPlan) return `${p.done} of ${p.planned} this week`;
  // No plan: the reason is the days since, unless they trained in the last three.
  return p.daysSince > 3 ? null : `last trained ${sinceLabel(p.daysSince)}`;
}
