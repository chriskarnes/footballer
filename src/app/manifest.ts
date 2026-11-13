import type { MetadataRoute } from 'next';
import { getAcademy } from '@/lib/branding-server';
import { appOf } from '@/lib/app-identity';

/**
 * Served by Next at /manifest.webmanifest.
 *
 * `background_color` is the page colour rather than black, because it is what fills
 * the launch screen while the app boots — a dark flash before a light UI reads as a
 * bug. `id` is set explicitly so that changing `start_url` later doesn't make the
 * browser treat it as a different app and orphan everyone's installed copy.
 *
 * Each academy is its own app: its name under the icon, its logo (brand/icon)
 * as the icon, and its kit colour behind the status bar. Library is only a
 * shortcut where the academy has one.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const academy = (await getAcademy()).academy;
  const { name, own, v } = appOf(academy);
  const icon = (size: number, maskable = false) => `/brand/icon?size=${size}${maskable ? '&maskable=1' : ''}&v=${v}`;
  return {
    id: '/',
    name,
    short_name: name,
    description:
      'Individual soccer training. Tell it how long you have and what you want to work on.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // The launch screen is the page's white, before the first paint.
    background_color: '#FFFFFF',
    theme_color: academy?.branding.primary ?? '#1B1B1B',
    categories: ['sports', 'health', 'education'],
    icons: own ? [
      { src: icon(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon(512), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon(512, true), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ] : [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate file, not `purpose: 'any maskable'`. A maskable icon has 20% padding
      // baked in, so reusing one as a normal icon renders it small and floating.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the home-screen icon. Android honours these; iOS ignores them.
    shortcuts: [
      { name: 'Train now', short_name: 'Train', url: '/?source=shortcut' },
      ...(!academy || academy.libraryAccess ? [{ name: 'Browse drills', short_name: 'Library', url: '/library?source=shortcut' }] : []),
    ],
  };
}
