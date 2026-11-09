'use server';
import { getViewer } from '@/lib/viewer';

/** Asks to join the academy this request came in on. */
export async function askToJoin(name: string, message: string) {
  const v = await getViewer();
  if (!v.academy || !v.user) return { ok: false as const, error: 'Sign in first.' };
  const n = name.trim().slice(0, 80);
  if (!n) return { ok: false as const, error: 'Add the player’s name, so your trainer knows who it is.' };
  const { error } = await v.db.rpc('request_to_join', { p_slug: v.academy.slug, p_name: n, p_message: message.trim().slice(0, 300) });
  if (error) return { ok: false as const, error: 'Couldn’t send that. Try again in a minute.' };
  return { ok: true as const };
}
