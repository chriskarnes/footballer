import { NextResponse, type NextRequest } from 'next/server';
import { ROOT_DOMAIN, slugFromHost } from '@/lib/tenant';

/**
 * The marketing site lives on the bare domain. Its pages are files under
 * app/site; here the bare domain's `/`, `/coaches`, `/players` and `/start`
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
const PAGES = ['/coaches', '/players', '/start'];

export function proxy(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  if (slugFromHost(host)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const name = host.toLowerCase().replace(/:\d+$/, '');
  const apex = name === ROOT_DOMAIN || name === `www.${ROOT_DOMAIN}`;

  let target: string | null = null;
  if (pathname === '/' && apex) target = '/site';
  else if (PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) target = `/site${pathname}`;
  else if (pathname === '/site' || pathname.startsWith('/site/')) target = pathname;
  if (!target) return NextResponse.next();

  const headers = new Headers(req.headers);
  headers.set('x-site', '1');
  const url = req.nextUrl.clone();
  url.pathname = target;
  return target === pathname
    ? NextResponse.next({ request: { headers } })
    : NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ['/', '/coaches/:path*', '/players/:path*', '/start/:path*', '/site/:path*'],
};
