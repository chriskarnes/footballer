import type { AcademyContent } from './academy-data';

/**
 * Where a library session is used, in words: "Foundations week 1",
 * "Foundations weeks 2 and 3". `except` leaves out one placement, for "also
 * used in".
 */
export function placesOf(c: Pick<AcademyContent, 'sessions' | 'programs'>, libraryId: string, except?: string): string[] {
  const uses = c.sessions.filter((s) => s.library_id === libraryId && s.id !== except);
  return c.programs.flatMap((p) => {
    const weeks = [...new Set(uses.filter((s) => s.program_id === p.id).map((s) => s.week))].sort((a, b) => a - b);
    if (!weeks.length) return [];
    const list = weeks.length === 1 ? `week ${weeks[0]}`
      : `weeks ${weeks.slice(0, -1).join(', ')} and ${weeks[weeks.length - 1]}`;
    return [`${p.name} ${list}`];
  });
}
