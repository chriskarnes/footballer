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
  if (error) return { ok: false as const, error: error.message };
  if (who === 'player' || who === 'parent') {
    const { data: { user } } = await db.auth.getUser();
    if (user) await db.from('profiles').upsert({ id: user.id, signed_up_by: who });
  }
  redirect((data as { role: string }).role === 'player' ? '/?joined=1' : '/coach');
}
