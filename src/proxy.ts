import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { ROOT_DOMAIN, slugFromHost } from '@/lib/tenant';

/**
 * The marketing site lives on the bare domain. Its pages are files under
 * app/site; here the bare domain's `/`, `/trainers`, `/players` and `/start`
 * are served from there, and the layout is told (x-site) to drop the app's
 * tab bar for them.
 *
 * Only `/` is special-cased by host: on train.futbol it is the site, while on
 * plain localhost and Vercel previews it stays the app, so local development
 * still opens on Train. The site's home is at /site there.
 *
 * Everything else on the bare domain — calendar feeds, auth callbacks — is
 * untouched. On an academy's subdomain none of this runs: its `/` is the app.
 */
const PAGES = ['/trainers', '/players', '/start'];

/**
 * Keeps the sign-in fresh. Pages and server actions read the session but
 * can't write cookies, so when the hour-long access token runs out a page
 * would renew it and throw the new one away, spending the renewal token: the
 * next use of the old one signs the player out. Renewing it here, before the
 * page, writes it back, to the page (the request) and the phone (the response).
 * Signed-out visitors have no auth cookie and skip it.
 */
type Fresh = { name: string; value: string; options?: CookieOptions };

async function freshSession(req: NextRequest): Promise<Fresh[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !req.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name))) return [];
  const out: Fresh[] = [];
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: Fresh[]) => {
        for (const c of list) { req.cookies.set(c.name, c.value); out.push(c); }
      },
    },
  });
  // getUser renews an expired token (and checks it); a failure here is the
  // page's to deal with, as before.
  try { await db.auth.getUser(); } catch { /* offline, or auth down */ }
  return out;
}

export async function proxy(req: NextRequest) {
  const fresh = await freshSession(req);
  const res = route(req);
  for (const c of fresh) res.cookies.set(c.name, c.value, c.options);
  return res;
}

function route(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  // The trainer area's frame isn't picked here: a header only reaches the
  // layout on a full page load. See components/AreaFrame.

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  // Carries any renewed sign-in on to the page (freshSession set it on req).
  const pass = () => NextResponse.next({ request: { headers: new Headers(req.headers) } });
  if (slugFromHost(host)) return pass();

  // A sign-in link that failed comes back from Supabase to the site's front
  // door with an error on it; on the bare domain that's the marketing page,
  // which would say nothing. Me says what happened and sends a new one.
  if (pathname === '/' && req.nextUrl.searchParams.has('error_code')) {
    return NextResponse.redirect(new URL('/me?auth=error', req.url));
  }

  // The trainers page was /coaches for a day; keep old links working.
  if (pathname === '/coaches') return NextResponse.redirect(new URL('/trainers', req.url), 308);
  const name = host.toLowerCase().replace(/:\d+$/, '');
  const apex = name === ROOT_DOMAIN || name === `www.${ROOT_DOMAIN}`;

  let target: string | null = null;
  if (pathname === '/' && apex) target = '/site';
  else if (PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) target = `/site${pathname}`;
  else if (pathname === '/site' || pathname.startsWith('/site/')) target = pathname;
  if (!target) return pass();

  const headers = new Headers(req.headers);
  headers.set('x-site', '1');
  const url = req.nextUrl.clone();
  url.pathname = target;
  return target === pathname
    ? NextResponse.next({ request: { headers } })
    : NextResponse.rewrite(url, { request: { headers } });
}

// Every page, action and API call, so the sign-in is renewed wherever it's
// read. Not built files, images, the service worker or calendar feeds (which
// carry their own token and are fetched by calendar apps, never signed in).
export const config = {
  matcher: ['/((?!_next/static|_next/image|cal/|sw\\.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|json|webmanifest|js|css|map)$).*)'],
};
