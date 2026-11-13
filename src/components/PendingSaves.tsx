'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pendingFinish, pendingPlan, pendingWorkout } from '@/lib/pending';
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
    let live = true;
    // getSession reads the stored session without a request, so a signed-out
    // visitor with something waiting doesn't fire a 401 on every page load.
    const run = async () => {
      if (!pendingWorkout.peek() && !pendingPlan.peek() && !pendingFinish.peek()) return;
      try {
        const { data } = await browserClient().auth.getSession();
        if (!data.session) return;
      } catch { return; }   // Supabase not configured
      const saved = await Promise.all([pendingWorkout.flush(), pendingPlan.flush(), pendingFinish.flush()]);
      if (saved.some(Boolean) && live) router.refresh();
    };
    run();
    // A session finished on a field with no signal goes as soon as there is one.
    window.addEventListener('online', run);
    return () => { live = false; window.removeEventListener('online', run); };
  }, [router]);
  return null;
}
