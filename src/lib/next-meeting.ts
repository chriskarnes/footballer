/**
 * When a player next sees their trainer: the nearest of their groups' meeting
 * days, from today, said "today 5:00 pm" on the day. Shared by the week
 * (TrainerWeek) and the wait for one (Waiting), so the two never disagree.
 *
 * With the academy's time zone, a meeting already over today counts from
 * next week: at 7 pm, "today 5:00 pm" is the one just missed, not the next.
 * Without it there's no telling the hour there, so today's still reads as today.
 */
export function nextMeeting(groups: { when: string | null; day: number | null }[], today: number, timeZone?: string): string | null {
  const now = timeZone ? minutesNow(timeZone) : null;
  // Days until each meeting: 0 today, 7 when today's has been and gone.
  const until = (g: { when: string | null; day: number | null }) => {
    const d = (g.day! - today + 7) % 7;
    const at = d === 0 && now !== null ? minutesOf(g.when!) : null;
    return at !== null && at < now! ? 7 : d;
  };
  const meet = groups.filter((g) => g.when && g.day !== null).sort((a, b) => until(a) - until(b))[0];
  if (meet) return until(meet) === 0 ? meet.when!.replace(/^\w{3}/, 'today') : meet.when;
  // A time with no day known: still worth saying.
  return groups.find((g) => g.when)?.when ?? null;
}

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
