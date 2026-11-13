import type { AcademyContent } from './academy-data';

export type Setup = {
  /** Migration 0020 has run. Before it, nothing here is saved, and the dashboard doesn't nag. */
  ready: boolean;
  you: boolean;
  done: boolean;
  timeZone: string;
  /** Shown in Find your trainer. Finishing setup turns it on, unless the owner chose not to. */
  listed: boolean;
};

/**
 * Where an academy is in its setup checklist: the two steps its owner marks
 * (academies.setup, from 0020), and its time zone, which the first step sets.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readSetup(db: any, academyId: string): Promise<Setup> {
  const { data, error } = await db.from('academies').select('setup, time_zone, listed').eq('id', academyId).maybeSingle();
  const marks = (data?.setup ?? {}) as Record<string, string>;
  return { ready: !error, you: !!marks.you, done: !!marks.done, timeZone: data?.time_zone ?? 'America/New_York', listed: data?.listed !== false };
}

/** An owner part-way through setup: the editors lead back to the checklist. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function inSetup(db: any, academyId: string, role: string | null): Promise<boolean> {
  if (role !== 'owner') return false;
  const s = await readSetup(db, academyId);
  return s.ready && !s.done;
}

/**
 * The five steps, done or not. The middle three are read from what the
 * academy has in it, so they can't disagree with the pages that make them:
 * three drills, a session, a program with a session in it.
 */
export function setupSteps(s: Setup, c: Pick<AcademyContent, 'drills' | 'library' | 'sessions' | 'programs'>): boolean[] {
  return [
    s.you,
    c.drills.length >= 3,
    c.library.length > 0 || c.sessions.length > 0,
    c.programs.some((p) => c.sessions.some((x) => x.program_id === p.id)),
    s.done,
  ];
}
