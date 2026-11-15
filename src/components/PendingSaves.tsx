'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PENDING_FLUSH, PENDING_SENT, pendingFinish, pendingPlan, pendingWorkout } from '@/lib/pending';
import { whoIsHere } from '@/lib/phone-session';
import { notePageCacheUser } from '@/lib/page-cache';

/**
 * Saves what was made signed out — a finished session, a built week — once
 * there is an account to save it to.
 *
 * It lives in the layout rather than on the sign-in callback because the
 * callback is a server route and the work is in the browser. Every page load
 * checks; with nothing waiting, or nobody signed in, nothing is sent.
 * The sign-in link lands on /me, so the usual path is: arrive signed in, send,
 * refresh, and it's already there.
 */
export function PendingSaves() {
  const router = useRouter();
  useEffect(() => {
    let live = true;
    // The stored session is read without a request, so a signed-out visitor
    // with something waiting doesn't fire a 401 on every page load.
    const run = async () => {
      // Couldn't tell (no signal and a sign-in due for renewal, or accounts
      // not set up): nothing is sent, and nothing on the phone is cleared.
      // Read as a sign-out, this used to empty the offline pages and the
      // player's unsent Speed results at a field with no signal.
      const here = await whoIsHere();
      if (here.state === 'unknown') return;
      const uid = here.state === 'in' ? here.uid : null;
      // A different account on this phone than the cached pages were for.
      await notePageCacheUser(uid);
      if (!uid) return;
      if (!pendingWorkout.peek(uid) && !pendingPlan.peek(uid) && !pendingFinish.peek(uid)) return;
      const done = await Promise.all([pendingWorkout.flush(uid), pendingPlan.flush(uid), pendingFinish.flush(uid)]);
      // Settled (saved, or turned down): a finish screen still open says which.
      if (done.some((d) => d.settled)) window.dispatchEvent(new Event(PENDING_SENT));
      if (done.some((d) => d.saved) && live) router.refresh();
    };
    run();
    // A session finished on a field with no signal goes as soon as there is
    // one. "online" often doesn't fire on a weak signal, so also when the app
    // comes back to the front, every half minute while anything waits, and
    // when asked ("Try now").
    const visible = () => { if (document.visibilityState === 'visible') run(); };
    const tick = window.setInterval(() => {
      if (pendingWorkout.any() || pendingPlan.any() || pendingFinish.any()) run();
    }, 30_000);
    window.addEventListener('online', run);
    window.addEventListener(PENDING_FLUSH, run);
    document.addEventListener('visibilitychange', visible);
    return () => {
      live = false; window.clearInterval(tick);
      window.removeEventListener('online', run); window.removeEventListener(PENDING_FLUSH, run);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [router]);
  return null;
}
