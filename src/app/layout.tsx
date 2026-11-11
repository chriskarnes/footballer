import type { Metadata, Viewport } from 'next';
// Self-hosted via npm: no Google Fonts request, no layout shift, works offline.
// `wdth` rather than the default entry point — the M3 typescale sets
// font-stretch, and only the wdth build ships that axis. See globals.css.
import '@fontsource-variable/roboto-flex/wdth.css';
import '@fontsource-variable/noto-sans';
import './globals.css';
import { TabBar } from '@/components/TabBar';
import { InstallNudge } from '@/components/InstallNudge';
import { ServiceWorker } from '@/components/ServiceWorker';
import { PendingSaves } from '@/components/PendingSaves';
import { getAcademy } from '@/lib/branding-server';
import { libraryFor } from '@/lib/library-gate';
import { ROOT_DOMAIN } from '@/lib/tenant';
import { brandCss } from '@/lib/brand-colors';
import { headers } from 'next/headers';
import { SiteChrome } from '@/components/site/SiteChrome';
import { Unclaimed } from '@/components/site/Unclaimed';
import { CoachFrame } from '@/components/coach/CoachFrame';
import { Brand } from '@/components/Brand';

export async function generateMetadata(): Promise<Metadata> {
  const name = (await getAcademy()).academy?.branding.name ?? 'Train.futbol';
  return { ...metadata, title: name, applicationName: name,
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Deliberately no maximumScale / userScalable:false. Blocking pinch zoom fails
  // WCAG 1.4.4, and iOS ignores it regardless. Double-tap zoom is handled instead
  // by `touch-action: manipulation` in globals.css, which is the accessible fix.
  viewportFit: 'cover',                  // let content reach under the notch
  interactiveWidget: 'resizes-content',  // keyboard pushes the layout, not covers it
  // Two entries, not one: the status bar has to follow the scheme now that there
  // is a dark one. A single light value would leave a white bar above a dark app.
  // These are md-sys-color-surface in each scheme — the literal is unavoidable,
  // since a meta tag cannot read a custom property.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
};

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
  // The trainer area (see proxy.ts): its own frame, wider on desktop, and
  // none of the player tabs.
  if ((await headers()).get('x-area') === 'coach') {
    return (
      <html lang="en">
        <body className="min-h-dvh antialiased">
          {brand?.primary && brand.accent && <style id="brand-tokens" dangerouslySetInnerHTML={{ __html: brandCss(brand.primary, brand.accent) }} />}
          <CoachFrame brand={<Brand small />}>{children}</CoachFrame>
          <ServiceWorker />
          <PendingSaves />
        </body>
      </html>
    );
  }
  const lib = await libraryFor().catch(() => ({ drills: true, own: false }));
  return (
    <html lang="en">
      <body className="pad-nav min-h-dvh antialiased">
        {/* The admin's colours, as overrides of the brand tokens in
            globals.css. In the body so it lands after the stylesheet and wins
            at equal specificity. Values are validated #RRGGBB, never raw input. */}
        {brand?.primary && brand.accent && <style id="brand-tokens" dangerouslySetInnerHTML={{ __html: brandCss(brand.primary, brand.accent) }} />}
        <main className="safe-t safe-x mx-auto w-full max-w-lg px-5">{children}</main>
        <TabBar academyId={academy?.id ?? null} library={lib.drills || lib.own} plan={lib.drills} />
        <InstallNudge />
        <ServiceWorker />
        <PendingSaves />
      </body>
    </html>
  );
}
