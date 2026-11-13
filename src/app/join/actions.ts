'use server';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';

/**
 * Joins with the code; the database decides the role. Trainers land on their
 * players. `who` is whose email this is, the player's or a parent's; it is
 * kept on the profile, and skipped quietly if migration 0009 hasn't run.
 */
export async function joinAcademy(code: string, who?: 'player' | 'parent') {
  const db = await serverClient();
  let { data, error } = await db.rpc('join_academy', { p_code: code });
  // Two taps (or two tabs) at once: the second insert hits the first one's
  // row. They're in, so ask again, which finds them there.
  if (error?.code === '23505') ({ data, error } = await db.rpc('join_academy', { p_code: code }));
  if (error) {
    console.error('join_academy', error);
    return { ok: false as const, error: /not found|invalid/i.test(error.message)
      ? 'This invite link has changed. Ask your trainer for the current one.'
      : /not signed in/i.test(error.message) ? 'You’ve been signed out. Sign in again, then tap Join.'
      : 'Couldn’t join just now. Try again.' };
  }
  const { data: { user } } = await db.auth.getUser();
  if (user && (who === 'player' || who === 'parent')) await db.from('profiles').upsert({ id: user.id, signed_up_by: who });
  if ((data as { role: string }).role !== 'player') redirect('/coach');
  // A new player is asked their name (and the rest) first, on Me; their
  // trainer sees that name, not an email address. A name alone isn't enough:
  // one let in from a join request has the name they asked with, and nothing else.
  const { data: me } = user ? await db.from('profiles').select('display_name, age_band').eq('id', user.id).maybeSingle() : { data: null };
  redirect(me?.display_name && me?.age_band ? '/?joined=1' : '/me');
}
