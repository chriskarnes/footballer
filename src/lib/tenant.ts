/**
 * Which academy a host belongs to. `mike.train.futbol` is Mike's;
 * `train.futbol`, `www.` and anything else (a Vercel preview URL, plain
 * localhost) is no academy — the unbranded app.
 *
 * In development, `mike.localhost:3000` is Mike's: browsers resolve any
 * *.localhost to this machine, so no hosts file is needed.
 */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'train.futbol';

const SLUG = /^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$/;

export function slugFromHost(host: string): string | null {
  const name = host.toLowerCase().replace(/:\d+$/, '');
  const sub = name.endsWith(`.${ROOT_DOMAIN}`) ? name.slice(0, -ROOT_DOMAIN.length - 1)
    : name.endsWith('.localhost') ? name.slice(0, -'.localhost'.length)
    : null;
  if (!sub || sub === 'www' || !SLUG.test(sub)) return null;
  return sub;
}

/** An academy's own address, for links that must land on the right subdomain. */
export function academyOrigin(slug: string, current: string): string {
  const u = new URL(current);
  const local = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  return local ? `${u.protocol}//${slug}.localhost${u.port ? `:${u.port}` : ''}`
               : `https://${slug}.${ROOT_DOMAIN}`;
}

/** The main site's address (where Find your trainer is), from any academy's. */
export function rootOrigin(current: string): string {
  const u = new URL(current);
  const local = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  return local ? `${u.protocol}//localhost${u.port ? `:${u.port}` : ''}` : `https://${ROOT_DOMAIN}`;
}
