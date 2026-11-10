/**
 * The trainer's side of a player's calendar feed: each group's meeting, and
 * the week's sessions from their trainer on the days the app spreads them
 * to. UIDs are date + source, never content, so ticks update in place.
 */
import { buildWeek, type AddonRow, type CustomRow, type DrillRow, type GroupRow, type MoveRow, type PlayerProgramRow, type ProgramRow, type ScheduleRow, type SessionRow, type CompletionRow } from './academy-week';
import { addDays, mondayOf } from './progress';
import { todayIn, type IcsEvent } from './ics';

export type AcademyFeed = {
  user_id: string; time_zone: string;
  groups: GroupRow[]; memberships: { group_id: string; user_id: string }[];
  player_programs: PlayerProgramRow[]; programs: ProgramRow[]; sessions: SessionRow[];
  drills: DrillRow[]; addons: AddonRow[];
  /** Added in 0008; absent from a feed function that predates it. */
  schedules?: ScheduleRow[]; moves?: MoveRow[];
  /** Added in 0010. */
  custom?: CustomRow[];
};

const PAST = 14, FUTURE = 42;

export function academyEvents(feed: AcademyFeed, completed: CompletionRow[], origin: string, tz: string, now = new Date()): IcsEvent[] {
  const today = todayIn(tz, now);
  const from = addDays(today, -PAST), to = addDays(today, FUTURE);
  const events: IcsEvent[] = [];

  // Group sessions: the training itself, at its time.
  for (const g of feed.groups) {
    if (g.meets_weekday === null) continue;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7 !== g.meets_weekday) continue;
      events.push({
        uid: `group-${g.id}-${d}@train.futbol`, date: d,
        summary: `${g.name} · training`,
        description: 'Your group session.',
        timed: g.meets_time ? { start: g.meets_time, minutes: 60, timeZone: tz } : undefined,
      });
    }
  }

  // Homework, week by week.
  for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
    const items = buildWeek({
      userId: feed.user_id, today: monday, tz, groups: feed.groups, memberships: feed.memberships,
      playerPrograms: feed.player_programs, programs: feed.programs, sessions: feed.sessions,
      drills: feed.drills, addons: feed.addons, completions: completed,
      schedules: feed.schedules ?? [], moves: feed.moves ?? [], custom: feed.custom ?? [],
    });
    for (const it of items) {
      const date = addDays(monday, it.weekday);
      if (date < from || date > to) continue;
      const url = `${origin}/train/${it.kind}/${it.ref}`;
      events.push({
        uid: `${it.key.replace(':', '-')}-${date}@train.futbol`, date,
        summary: `${it.done ? '✓ ' : ''}${it.title} · ${it.minutes} min`,
        description: `${it.done ? 'Done. ' : ''}${it.kind === 'addon' ? 'Just for you, from your trainer.' : it.from}\n${url}`,
        url,
      });
    }
  }
  return events;
}
