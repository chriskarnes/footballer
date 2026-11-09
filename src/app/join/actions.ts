'use server';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';

/** Joins with the code; the database decides the role. Trainers land on their players. */
export async function joinAcademy(code: string) {
  const db = await serverClient();
  const { data, error } = await db.rpc('join_academy', { p_code: code });
  if (error) return { ok: false as const, error: error.message };
  redirect((data as { role: string }).role === 'player' ? '/?joined=1' : '/coach');
}
