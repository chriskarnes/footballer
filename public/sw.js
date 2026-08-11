/* Forge service worker.
 *
 * Deliberately small. The job is one thing: opening Forge on a phone with no signal
 * should show Forge, not the browser's dinosaur. That single behaviour is most of
 * what makes a web app feel installed.
 *
 * Two strategies, and the split matters:
 *
 *   /_next/static/*  cache-first. Next fingerprints these filenames with a content
 *                    hash, so a cached copy can never be stale — a changed file is a
 *                    changed URL.
 *   everything else  network-first, falling back to cache. Never cache-first on a
 *                    document: that is how people end up stuck on a build from three
 *                    deploys ago with no way to escape.
 *
 * API calls are not cached at all. A stale session or a stale history is worse than
 * an honest error.
 */

const VERSION = 'forge-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll([OFFLINE_URL, '/icon-192.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // YouTube thumbs, Supabase, etc.
  if (url.pathname.startsWith('/api/')) return;      // never serve stale data
  if (url.pathname.startsWith('/auth/')) return;     // magic-link callbacks must be live

  // Content-hashed build output: safe to serve from cache forever.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit || fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(ASSETS).then((c) => c.put(request, copy));
          return res;
        })
      )
    );
    return;
  }

  // Pages and everything else: fresh if we can get it, cached if we can't.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(ASSETS).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() =>
        caches.match(request).then((hit) =>
          hit || (request.mode === 'navigate' ? caches.match(OFFLINE_URL) : undefined)
        )
      )
  );
});
