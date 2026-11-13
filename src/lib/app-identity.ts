import type { Academy } from './branding-server';

/** The installed app's name and icon: the academy's own, once it has a logo or colours. */
export function appOf(academy: Academy | null | undefined) {
  const name = academy?.branding.name ?? academy?.name ?? 'Train.futbol';
  const own = !!academy && !!(academy.branding.logo || academy.branding.primary);
  // Everything drawn on the icon goes into its version: the logo (itself
  // versioned by upload), the color, and the name its initial comes from.
  // The icon caches for a year, so a rename kept the old letter.
  const v = academy ? hash(`${academy.branding.logo ?? ''}|${academy.branding.primary ?? ''}|${name}`) : '';
  return { name, own, v, icon: own ? `/brand/icon?size=192&v=${v}` : '/icon-192.png' };
}

/** A short, stable tag for a string (FNV-1a): a cache key, not a secret. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
