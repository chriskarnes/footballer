import type { Metadata, Viewport } from 'next';
// Self-hosted via npm: no Google Fonts request, no layout shift, works offline.
// `wdth` rather than the default entry point — the M3 typescale sets
// font-stretch, and only the wdth build ships that axis. See globals.css.
import '@fontsource-variable/roboto-flex/wdth.css';
import '@fontsource-variable/noto-sans';
import './globals.css';
import { speedAllowed } from '@/lib/speed-gate';
import { AreaFrame } from '@/components/AreaFrame';
import { ServiceWorker } from '@/components/ServiceWorker';
import { PendingSaves } from '@/components/PendingSaves';
import { getAcademy } from '@/lib/branding-server';
import { appOf } from '@/lib/app-identity';
import { libraryFor } from '@/lib/library-gate';
import { ROOT_DOMAIN } from '@/lib/tenant';
import { brandCss } from '@/lib/brand-colors';
import { headers } from 'next/headers';
import { SiteChrome } from '@/components/site/SiteChrome';
import { Unclaimed } from '@/components/site/Unclaimed';
import { Brand } from '@/components/Brand';

export async function generateMetadata(): Promise<Metadata> {
  // The marketing pages name themselves.
  if ((await headers()).get('x-site')) return metadata;
  // The academy's own icon (brand/icon), versioned so a new upload is a new URL.
  const { name, own, v } = appOf((await getAcademy()).academy);
  const icons = own ? {
    icon: [{ url: `/brand/icon?size=32&v=${v}`, type: 'image/png', sizes: '32x32' },
           { url: `/brand/icon?size=192&v=${v}`, type: 'image/png', sizes: '192x192' }],
    apple: [{ url: `/brand/icon?size=180&v=${v}`, sizes: '180x180' }],
  } : metadata.icons;
  // "Week · Forge Training": a tab, a bookmark or the app switcher says whose.
  return { ...metadata, title: { default: name, template: `%s · ${name}` }, applicationName: name, icons,
           appleWebApp: { ...metadata.appleWebApp, title: name } };
}

const metadata = {
  title: 'Train.futbol',
  description: 'Individual soccer training. 786 drills, built around your time and your weaknesses.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Train.futbol',
  appleWebApp: {
    capable: true,
    // What sits under the home-screen icon, where there is room for about 12
    // characters before iOS truncates. The dot is part of the name.
    title: 'Train.futbol',
    // `default` gives dark status-bar text over our light page. `black-translucent`
    // would put white text on a near-white background and make the clock vanish.
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  // Stops iOS turning "1 x 250-500" and every number in the library into a phone link.
  formatDetection: { telephone: false, date: false, address: false, email: false },
  // Next emits the modern `mobile-web-app-capable` from appleWebApp.capable above;
  // older iOS only reads the vendor-prefixed name, so it is added by hand.
  other: { 'apple-mobile-web-app-capable': 'yes' },
} satisfies Metadata;

/**
 * themeColor is the browser's bar above the page (Safari, Android). It's the
 * brand band's colour, since the band is what sits at the top: a white bar
 * over a black or royal-blue band read as a gap. The marketing pages keep
 * the page colour. A meta tag can't read a custom property, so the value is
 * the academy's own hex (#1B1B1B is the unbranded band, --app-brand-primary).
 */
export async function generateViewport(): Promise<Viewport> {
  const site = !!(await headers()).get('x-site');
  const band = site ? null : (await getAcademy()).academy?.branding.primary ?? '#1B1B1B';
  return {
    width: 'device-width',
    initialScale: 1,
    // Deliberately no maximumScale / userScalable:false. Blocking pinch zoom fails
    // WCAG 1.4.4, and iOS ignores it regardless. Double-tap zoom is handled instead
    // by `touch-action: manipulation` in globals.css, which is the accessible fix.
    viewportFit: 'cover',                  // let content reach under the notch
    interactiveWidget: 'resizes-content',  // keyboard pushes the layout, not covers it
    themeColor: band ?? [
      { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
      { media: '(prefers-color-scheme: dark)', color: '#121212' },
    ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The marketing pages (see proxy.ts): their own header and footer, wider,
  // and none of the app's tab bar or install prompts.
  if ((await headers()).get('x-site')) {
    return (
      // Always the light scheme at the root: the site sets its own dark parts
      // (.site-dark), so a dark-mode phone sees the same green-to-paper page.
      <html lang="en" data-theme="light">
        <body className="min-h-dvh bg-site-paper antialiased"><SiteChrome>{children}</SiteChrome></body>
      </html>
    );
  }
  const { slug, academy } = await getAcademy();
  const brand = academy?.branding;
  // A subdomain nobody has claimed: say so, rather than serve an unbranded
  // app at an address that looks like someone's.
  if (slug && academy === null) {
    const h = await headers();
    const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').toLowerCase();
    const local = /(^|\.)localhost(:\d+)?$/.test(host);
    const port = host.match(/:(\d+)$/)?.[1];
    const root = local ? `http://localhost${port ? `:${port}` : ''}` : `https://${ROOT_DOMAIN}`;
    return (
      <html lang="en">
        <body className="min-h-dvh antialiased">
          <Unclaimed slug={slug} root={root} rootLabel={local ? 'localhost' : ROOT_DOMAIN} />
        </body>
      </html>
    );
  }
  // The player tabs' settings, read on the trainer area too: this layout is
  // kept across client-side navigations, so a trainer who goes to Player
  // view gets the tab bar drawn from these.
  const [lib, speed] = await Promise.all([
    libraryFor().catch(() => ({ drills: true, own: false })),
    speedAllowed().catch(() => true),
  ]);
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {/* The admin's colours, as overrides of the brand tokens in
            globals.css. In the body so it lands after the stylesheet and wins
            at equal specificity. Values are validated #RRGGBB, never raw input. */}
        {brand?.primary && brand.accent && <style id="brand-tokens" dangerouslySetInnerHTML={{ __html: brandCss(brand.primary, brand.accent) }} />}
        {/* The player app, or the trainer area's own frame under /coach. */}
        <AreaFrame brand={<Brand small />} app={appOf(academy)} academyId={academy?.id ?? null}
                   library={lib.drills || lib.own} plan={lib.drills} speed={speed}>{children}</AreaFrame>
        <ServiceWorker />
        <PendingSaves />
      </body>
    </html>
  );
}
