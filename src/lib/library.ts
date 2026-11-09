import { cache } from 'react';
import { serverClient } from './supabase/server';
import type { Exercise, Program, SessionRow } from './types';
import { libraryAllowed } from './branding-server';

/**
 * Library reads. Cached per request. Falls back to the bundled JSON when
 * Supabase isn't configured yet, so `npm run dev` works before you set up the DB.
 *
 * Empty for any academy without library access (licensed content; see
 * libraryAllowed). Pages show <LibraryLocked/> instead; this is the backstop.
 */
async function fromDb<T>(table: string): Promise<T[] | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const db = await serverClient();
    const { data, error } = await db.from(table).select('*').limit(2000);
    if (error || !data?.length) return null;
    return data as T[];
  } catch {
    return null;
  }
}

async function bundled() {
  const lib = (await import('../../data/forge-library.json')).default as any;
  return lib;
}

export const getPrograms = cache(async (): Promise<Program[]> =>
  !(await libraryAllowed()) ? [] : (await fromDb<Program>('programs')) ?? (await bundled()).programs);

export const getSessions = cache(async (): Promise<SessionRow[]> =>
  !(await libraryAllowed()) ? [] : (await fromDb<SessionRow>('sessions')) ?? (await bundled()).sessions);

export const getExercises = cache(async (): Promise<Exercise[]> =>
  !(await libraryAllowed()) ? [] : (await fromDb<Exercise>('exercises')) ?? (await bundled()).exercises);
