import 'server-only';
import { drillName } from './drill-copy';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { serverClient } from './supabase/server';
import type { Exercise, Program, SessionRow } from './types';
import { getAcademy, libraryAllowed as licensed } from './branding-server';
import { getViewer } from './viewer';

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
    // The licensed library isn't readable with the public key (0031): it's
    // read here, on the server, once this request has been let see it.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const db = key
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } })
      : await serverClient();
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

/**
 * Whether this request may have the library at all: an academy with it,
 * and, other than the public demo, only for its members. Pages decide the finer
 * question (a trainer's "players may browse"); this is the backstop.
 */
const allowed = cache(async (): Promise<boolean> => {
  if (!(await licensed())) return false;
  const { academy } = await getAcademy();
  // The demo is the public showcase; anywhere else, members only.
  if (!academy || academy.slug === 'demo') return true;
  return !!(await getViewer()).role;
});

const sessionRows = cache(async (): Promise<SessionRow[]> =>
  (await fromDb<SessionRow>('sessions')) ?? (await bundled()).sessions);

export const getPrograms = cache(async (): Promise<Program[]> =>
  !(await allowed()) ? [] : (await fromDb<Program>('programs')) ?? (await bundled()).programs);

export const getSessions = cache(async (): Promise<SessionRow[]> =>
  !(await allowed()) ? [] : sessionRows());

// The library's names were typed in capitals: shown in title case everywhere.
export const getExercises = cache(async (): Promise<Exercise[]> =>
  !(await allowed()) ? []
    : ((await fromDb<Exercise>('exercises')) ?? (await bundled()).exercises).map((e: Exercise) => ({ ...e, name: drillName(e.name) })));

/**
 * For the calendar feed, which has no cookies: the feed's token says who,
 * and the route says whether they're a member. An academy with the library,
 * and other than the demo, only for a member.
 */
export async function feedSessions(member: boolean): Promise<SessionRow[]> {
  if (!(await licensed())) return [];
  const { academy } = await getAcademy();
  if (academy && academy.slug !== 'demo' && !member) return [];
  return sessionRows();
}
