import type { Academy } from './branding-server';

/** The installed app's name and icon: the academy's own, once it has a logo or colours. */
export function appOf(academy: Academy | null | undefined) {
  const name = academy?.branding.name ?? academy?.name ?? 'Train.futbol';
  const own = !!academy && !!(academy.branding.logo || academy.branding.primary);
  const v = academy ? encodeURIComponent(academy.branding.logo ?? academy.branding.primary ?? academy.id) : '';
  return { name, own, v, icon: own ? `/brand/icon?size=192&v=${v}` : '/icon-192.png' };
}
