'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { flushWorkout, peekWorkout } from '@/lib/pending-workout';
import { browserClient } from '@/lib/supabase/client';

/**
 * Saves a session finished signed out, once there is an account to save it to.
 *
 * It lives in the layout rather than on the sign-in callback because the
 * callback is a server route and the session is in the browser. Every page load
 * checks; with nothing waiting, or nobody signed in, nothing is sent.
 * The sign-in link lands on /me, so the usual path is: arrive signed in, send,
 * refresh, and the session is already in "What you've done".
 */
export function PendingWorkout() {
  const router = useRouter();
  useEffect(() => {
    if (!peekWorkout()) return;
    let live = true;
    // getSession reads the stored session without a request, so a signed-out
    // visitor with a session waiting doesn't fire a 401 on every page load.
    (async () => {
      try {
        const { data } = await browserClient().auth.getSession();
        if (!data.session) return;
      } catch { return; }   // Supabase not configured
      if (await flushWorkout() && live) router.refresh();
    })();
    return () => { live = false; };
  }, [router]);
  return null;
}
