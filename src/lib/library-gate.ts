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
 *           their trainer lets players browse. Trainers keep it, and
 *           visitors only on the demo.
 *   own     the academy's own programs and drills, in Library, where there
 *           is no licensed library: when players may browse.
 *
 * A self-serve space (0030) shows nothing to someone who hasn't joined it:
 * it's private while it holds the licensed library, and its way in is the
 * page shown instead.
 */
export const libraryFor = cache(async (): Promise<{ drills: boolean; own: boolean }> => {
  const base = await licensed();
  const v = await getViewer();
  if (v.academy?.selfServe && !v.role) return { drills: false, own: false };
  // Visitors (signed out, or not in this academy) see it only on the demo,
  // which is the public showcase; the other licensed academies are private.
  if (!v.academy || !v.user || !v.role) return { drills: base && (!v.academy || v.academy.slug === 'demo'), own: false };
  const browse = (await loadDefaults(v.db, v.academy.id)).playerLibrary;
  if (base) return { drills: v.staff || browse, own: false };
  return { drills: false, own: browse };
});

/** The licensed drill library, for this viewer. */
export const libraryAllowed = async () => (await libraryFor()).drills;
