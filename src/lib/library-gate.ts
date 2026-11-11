import 'server-only';
import { cache } from 'react';
import { libraryAllowed as licensed } from './branding-server';
import { getViewer } from './viewer';
import { loadDefaults } from './academy-data';

/**
 * Whether this viewer gets the libraries, as their trainer set it (0015).
 *
 *   drills  the licensed drill library (Train's builder, Library, Plan). Only
 *           where the academy has library_access; and for a player, only when
 *           their trainer lets players browse. Trainers and signed-out
 *           visitors to a library academy (the demo) keep it.
 *   own     the academy's own programs and drills, in Library, where there
 *           is no licensed library: when players may browse.
 */
export const libraryFor = cache(async (): Promise<{ drills: boolean; own: boolean }> => {
  const base = await licensed();
  const v = await getViewer();
  if (!v.academy || !v.user || !v.role) return { drills: base, own: false };
  const browse = (await loadDefaults(v.db, v.academy.id)).playerLibrary;
  if (base) return { drills: v.staff || browse, own: false };
  return { drills: false, own: browse };
});

/** The licensed drill library, for this viewer. */
export const libraryAllowed = async () => (await libraryFor()).drills;
