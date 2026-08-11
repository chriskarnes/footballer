'use client';
import { useEffect } from 'react';

/**
 * Registers the offline shell.
 *
 * Registration is deferred to `load` so it never competes with the first render —
 * a service worker that slows down the first visit has defeated its own purpose.
 * Skipped entirely in development, where a caching layer between you and your
 * changes is nothing but a source of confusing bugs.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* Blocked by a private window or an enterprise policy. The app is fully
           functional without it; the only loss is the offline fallback. */
      });
    };

    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
