import { headers } from 'next/headers';
import { rootOrigin } from './tenant';

/** The main site's address for this request, for "Find your trainer" links off a dead end. */
export async function rootHref(path = '/players'): Promise<string> {
  const h = await headers();
  const here = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost'}`;
  try { return `${rootOrigin(here)}${path}`; } catch { return path; }
}
