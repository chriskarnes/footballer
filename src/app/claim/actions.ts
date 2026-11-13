'use server';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { plain } from '@/lib/plain-error';

/**
 * Makes the signed-in account the academy's owner, if it's the email the
 * request came from (the database checks), then opens the setup checklist.
 */
export async function claimAcademy(code: string): Promise<{ ok: false; error: string }> {
  const db = await serverClient();
  const { error } = await db.rpc('claim_academy', { p_code: code });
  if (error) {
    const m = error.message;
    return {
      ok: false,
      error: /wrong email/.test(m) ? 'wrong-email'
        : /already claimed/.test(m) ? 'This academy already has its owner.'
        : /not signed in/.test(m) ? 'Sign in first.'
        : /claim not found/.test(m) ? 'This link doesn’t work any more.'
        : /Could not find the function|function .* does not exist/i.test(m) ? 'This isn’t switched on yet. Reply to the email and we’ll sort it out.'
        : plain(error, 'Couldn’t claim it just now. Try again.'),
    };
  }
  redirect('/coach/setup');
}
