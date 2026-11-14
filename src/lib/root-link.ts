import { headers } from 'next/headers';
import { academyOrigin, rootOrigin } from './tenant';

/** The main site's address for this request, for "Find your trainer" links off a dead end. */
export async function rootHref(path = '/players'): Promise<string> {
  const h = await headers();
  const here = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost'}`;
  try { return `${rootOrigin(here)}${path}`; } catch { return path; }
}

/**
 * Where the self-serve space is (0030), only once it's open to all: the main
 * site's "No trainer?" way in. Null while it's closed, or before 0030 runs.
 */
export async function selfServeHref(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).rpc('open_self_serve');
    if (error || typeof data !== 'string' || !data) return null;
    const h = await headers();
    const here = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost'}`;
    return academyOrigin(data, here);
  } catch { return null; }
}
