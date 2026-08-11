'use client';
import { useEffect } from 'react';

/**
 * Keeps the screen awake while a session is running.
 *
 * This is the single most app-like thing on the list. A player props the phone
 * against a cone, does a 90-second drill, looks up and the screen has locked — that
 * is a browser behaving like a browser, and it is infuriating mid-session.
 *
 * Screen Wake Lock is supported in Chrome and in iOS Safari 16.4+, and it works in
 * a normal browser tab — no install required. It releases itself when the tab is
 * hidden, so it must be re-acquired on `visibilitychange`, which is the part people
 * miss.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) { next.release().catch(() => {}); return; }
        lock = next;
      } catch {
        /* Denied on low battery, or the browser lied about support. Not worth telling
           the user about — the cost is only that the screen dims as it normally would. */
      }
    };

    // The lock is dropped automatically whenever the tab loses visibility.
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
