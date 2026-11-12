import 'server-only';
import { cache } from 'react';
import { getViewer } from './viewer';
import { loadDefaults } from './academy-data';

/**
 * Whether this viewer gets Speed & Stamina (0019). It's the trainer's choice
 * for their players, and on unless they turn it off. Trainers keep it, so
 * they can see what they'd be offering; so does anyone signed out or outside
 * an academy.
 */
export const speedAllowed = cache(async (): Promise<boolean> => {
  const v = await getViewer();
  if (!v.academy || !v.user || !v.role || v.staff) return true;
  return (await loadDefaults(v.db, v.academy.id)).playerSpeed;
});
