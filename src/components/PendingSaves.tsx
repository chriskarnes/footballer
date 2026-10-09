'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pendingPlan, pendingWorkout } from '@/lib/pending';
import { browserClient } from '@/lib/supabase/client';

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
    if (!pendingWorkout.peek() && !pendingPlan.peek()) return;
    let live = true;
    // getSession reads the stored session without a request, so a signed-out
    // visitor with something waiting doesn't fire a 401 on every page load.
    (async () => {
      try {
        const { data } = await browserClient().auth.getSession();
        if (!data.session) return;
      } catch { return; }   // Supabase not configured
      const saved = await Promise.all([pendingWorkout.flush(), pendingPlan.flush()]);
      if (saved.some(Boolean) && live) router.refresh();
    })();
    return () => { live = false; };
  }, [router]);
  return null;
}
