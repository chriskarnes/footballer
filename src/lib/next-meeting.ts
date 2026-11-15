/**
 * When a player next sees their trainer: the nearest of their groups' meeting
 * days, from today, said "today 5:00 pm" on the day. Shared by the week
 * (TrainerWeek) and the wait for one (Waiting), so the two never disagree.
 *
 * With the academy's time zone, a meeting already over today counts from
 * next week, said "Tue 5:00 pm, next week": on a Tuesday evening, a bare "Tue
 * 5:00 pm" reads as tonight's. It's over an hour and a half after it starts
 * (MEETING_MINUTES), not the minute it starts: at 5:30 the player's still
 * there, and "next week" would be wrong. Without the time zone there's no
 * telling the hour there, so today's still reads as today.
 */
export function nextMeeting(groups: { when: string | null; day: number | null }[], today: number, timeZone?: string): string | null {
  const now = timeZone ? minutesNow(timeZone) : null;
  // Days until each meeting: 0 today, 7 when today's has been and gone.
  const until = (g: { when: string | null; day: number | null }) => {
    const d = (g.day! - today + 7) % 7;
    const at = d === 0 && now !== null ? minutesOf(g.when!) : null;
    return at !== null && at + MEETING_MINUTES <= now! ? 7 : d;
  };
  const meet = groups.filter((g) => g.when && g.day !== null).sort((a, b) => until(a) - until(b))[0];
  if (meet) {
    const d = until(meet);
    return d === 0 ? meet.when!.replace(/^\w{3}/, 'today') : d === 7 ? `${meet.when}, next week` : meet.when;
  }
  // A time with no day known: still worth saying.
  return groups.find((g) => g.when)?.when ?? null;
}

/** How long a meeting counts as still on after it starts. */
const MEETING_MINUTES = 90;

/** Minutes past midnight in a label's "5:00 pm", or null when it has no time. */
function minutesOf(when: string): number | null {
  const m = /(\d{1,2}):(\d{2}) (am|pm)$/.exec(when);
  return m ? (+m[1] % 12 + (m[3] === 'pm' ? 12 : 0)) * 60 + +m[2] : null;
}

/** Minutes past midnight now, on the clock in `tz`. */
function minutesNow(tz: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return +p.hour * 60 + +p.minute;
}
