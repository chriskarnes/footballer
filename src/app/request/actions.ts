'use server';
import { getViewer } from '@/lib/viewer';

/** Asks to join the academy this request came in on. */
export async function askToJoin(name: string, message: string, who?: 'player' | 'parent') {
  const v = await getViewer();
  if (!v.academy || !v.user) return { ok: false as const, error: 'Sign in first.' };
  // A self-serve space (0030) has no one to ask.
  if (v.academy.selfServe) return { ok: false as const, error: 'There’s no one to ask here. Open the invite link you were sent.' };
  const n = name.trim().slice(0, 80);
  if (!n) return { ok: false as const, error: 'Add the player’s name, so your trainer knows who it is.' };
  const as = who === 'player' || who === 'parent' ? who : null;
  let { data, error } = await v.db.rpc('request_to_join', { p_slug: v.academy.slug, p_name: n, p_message: message.trim().slice(0, 300), p_as: as });
  // Before 0027 there's no p_as.
  if (error?.code === 'PGRST202') ({ data, error } = await v.db.rpc('request_to_join', { p_slug: v.academy.slug, p_name: n, p_message: message.trim().slice(0, 300) }));
  if (error) return { ok: false as const, error: 'Couldn’t send that. Try again in a minute.' };
  // Let in already (from another tab, or by the trainer): nothing was asked.
  // Asked to train here already (0029): that request stands.
  if (data === 'trainer_asked') return { ok: false as const, error: 'This account has asked to train here. The owner will answer that first.' };
  return { ok: true as const, member: data === 'member' };
}
