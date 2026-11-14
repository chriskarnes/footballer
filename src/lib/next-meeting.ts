/**
 * When a player next sees their trainer: the nearest of their groups' meeting
 * days, from today, said "today 5:00 pm" on the day. Shared by the week
 * (TrainerWeek) and the wait for one (Waiting), so the two never disagree.
 */
export function nextMeeting(groups: { when: string | null; day: number | null }[], today: number): string | null {
  const meet = groups.filter((g) => g.when && g.day !== null)
    .sort((a, b) => ((a.day! - today + 7) % 7) - ((b.day! - today + 7) % 7))[0];
  if (meet) return meet.day === today ? meet.when!.replace(/^\w{3}/, 'today') : meet.when;
  // A time with no day known: still worth saying.
  return groups.find((g) => g.when)?.when ?? null;
}
