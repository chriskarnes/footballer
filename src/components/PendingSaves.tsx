'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PENDING_SENT, pendingFinish, pendingPlan, pendingWorkout } from '@/lib/pending';
import { browserClient } from '@/lib/supabase/client';
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
    // getSession reads the stored session without a request, so a signed-out
    // visitor with something waiting doesn't fire a 401 on every page load.
    const run = async () => {
      let uid: string | null = null;
      try {
        const { data } = await browserClient().auth.getSession();
        uid = data.session?.user.id ?? null;
        // A different account on this phone than the cached pages were for.
        await notePageCacheUser(uid);
      } catch { return; }   // Supabase not configured
      if (!uid) return;
      if (!pendingWorkout.peek(uid) && !pendingPlan.peek(uid) && !pendingFinish.peek(uid)) return;
      const saved = await Promise.all([pendingWorkout.flush(uid), pendingPlan.flush(uid), pendingFinish.flush(uid)]);
      if (saved.some(Boolean)) {
        window.dispatchEvent(new Event(PENDING_SENT));
        if (live) router.refresh();
      }
    };
    run();
    // A session finished on a field with no signal goes as soon as there is one.
    window.addEventListener('online', run);
    return () => { live = false; window.removeEventListener('online', run); };
  }, [router]);
  return null;
}
