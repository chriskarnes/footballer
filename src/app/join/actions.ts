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
  const { data, error } = await db.rpc('join_academy', { p_code: code });
  if (error) {
    console.error('join_academy', error);
    return { ok: false as const, error: /not found|invalid/i.test(error.message)
      ? 'This invite link has changed. Ask your trainer for the current one.'
      : 'Couldn’t join just now. Try again.' };
  }
  const { data: { user } } = await db.auth.getUser();
  if (user && (who === 'player' || who === 'parent')) await db.from('profiles').upsert({ id: user.id, signed_up_by: who });
  if ((data as { role: string }).role !== 'player') redirect('/coach');
  // A new player is asked their name (and the rest) first, on Me; their
  // trainer sees that name, not an email address.
  const { data: me } = user ? await db.from('profiles').select('display_name').eq('id', user.id).maybeSingle() : { data: null };
  redirect(me?.display_name ? '/?joined=1' : '/me');
}
