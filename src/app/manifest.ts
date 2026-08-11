import type { MetadataRoute } from 'next';

/**
 * Served by Next at /manifest.webmanifest.
 *
 * `background_color` is the page colour rather than black, because it is what fills
 * the launch screen while the app boots — a dark flash before a light UI reads as a
 * bug. `id` is set explicitly so that changing `start_url` later doesn't make the
 * browser treat it as a different app and orphan everyone's installed copy.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Forge — Elite Accelerator',
    short_name: 'Forge',
    description:
      'Individual soccer training. Tell it how long you have and what you want to work on.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F6F6F4',
    theme_color: '#F6F6F4',
    categories: ['sports', 'health', 'education'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate file, not `purpose: 'any maskable'`. A maskable icon has 20% padding
      // baked in, so reusing one as a normal icon renders it small and floating.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the home-screen icon. Android honours these; iOS ignores them.
    shortcuts: [
      { name: 'Train now', short_name: 'Train', url: '/?source=shortcut' },
      { name: 'Browse drills', short_name: 'Library', url: '/library?source=shortcut' },
    ],
  };
}
