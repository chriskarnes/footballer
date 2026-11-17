import { addDays, localDate, mondayOf } from './progress';

/**
 * What a player has to show for their training, for Me: this week, how many
 * weeks running, and everything so far. Weeks, not days: a player with
 * practice and games has rest days, and a daily streak would punish them.
 */
export type MyProgress = { thisWeek: number; weeks: number; sessions: number; touches: number };

export function myProgress(done: { at: string; touches: number }[], tz: string, now: Date = new Date()): MyProgress {
  const thisMonday = mondayOf(localDate(now, tz));
  const mondays = new Set<string>();
  let thisWeek = 0, touches = 0;
  for (const w of done) {
    const monday = mondayOf(localDate(w.at, tz));
    mondays.add(monday);
    if (monday === thisMonday) thisWeek++;
    touches += w.touches || 0;
  }
  // Counted back from this week, or from last week if this one hasn't started
  // yet: on a Monday morning the run isn't broken.
  let from = mondays.has(thisMonday) ? thisMonday : addDays(thisMonday, -7);
  let weeks = 0;
  while (mondays.has(from)) { weeks++; from = addDays(from, -7); }
  return { thisWeek, weeks, sessions: done.length, touches };
}
