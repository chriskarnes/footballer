import type { Metadata, Viewport } from 'next';
// Self-hosted via npm: no Google Fonts request, no layout shift, works offline.
import '@fontsource-variable/sora';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';
import { TabBar } from '@/components/TabBar';
import { InstallNudge } from '@/components/InstallNudge';
import { ServiceWorker } from '@/components/ServiceWorker';

export const metadata: Metadata = {
  title: 'Forge — Elite Accelerator',
  description: 'Individual soccer training. 786 drills, built around your time and your weaknesses.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Forge',
  appleWebApp: {
    capable: true,
    title: 'Forge',
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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Deliberately no maximumScale / userScalable:false. Blocking pinch zoom fails
  // WCAG 1.4.4, and iOS ignores it regardless. Double-tap zoom is handled instead
  // by `touch-action: manipulation` in globals.css, which is the accessible fix.
  viewportFit: 'cover',                  // let content reach under the notch
  interactiveWidget: 'resizes-content',  // keyboard pushes the layout, not covers it
  themeColor: '#F6F6F4',                 // status bar matches the page, not a dark bar
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="pad-nav min-h-dvh antialiased">
        <main className="safe-t safe-x mx-auto w-full max-w-lg px-5">{children}</main>
        <TabBar />
        <InstallNudge />
        <ServiceWorker />
      </body>
    </html>
  );
}
