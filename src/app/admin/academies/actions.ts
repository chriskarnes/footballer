'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { academyTag } from '@/lib/branding-server';
import { serverClient } from '@/lib/supabase/server';

/**
 * Opens or closes a self-serve space (0030): open, anyone signed in joins with
 * a tap and the main site shows the way in. The database refuses it while the
 * space holds the licensed library, and refuses anyone but a platform admin.
 */
export async function setSelfServeOpen(id: string, slug: string, open: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await serverClient();
  const { error } = await db.rpc('admin_set_open', { p_academy: id, p_open: open });
  if (error) {
    console.error('admin_set_open', error);
    return { ok: false, error: /open_only_unlicensed|check constraint/i.test(error.message)
      ? 'It still has the Forge library, which is for private use. It stays invite-only until your own drills replace it.'
      : /not an admin/i.test(error.message) ? 'Only platform admins can open it.'
      : error.code === 'PGRST202' ? 'Run migration 0030 first.'
      : 'Couldn’t change that. Try again.' };
  }
  updateTag(academyTag(slug));
  revalidatePath('/admin/academies');
  revalidatePath(`/admin/academies/${id}`);
  return { ok: true };
}

/**
 * Replaces a self-serve space's invite link (0031): the old one stops
 * working. It has no owner to do it, so platform admins do.
 */
export async function replaceSelfServeInvite(id: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const db = await serverClient();
  const { data, error } = await db.rpc('admin_invite', { p_academy: id, p_rotate: true });
  if (error || typeof data !== 'string') {
    console.error('admin_invite', error);
    return { ok: false, error: error?.code === 'PGRST202' ? 'Run migration 0031 first.'
      : /not an admin/i.test(error?.message ?? '') ? 'Only platform admins can do that.' : 'Couldn’t replace it. Try again.' };
  }
  revalidatePath(`/admin/academies/${id}`);
  return { ok: true, code: data };
}

/**
 * Takes a player out of a self-serve space (0033): it has no owner to do
 * it. Their training stays theirs. The invite link is replaced with it
 * (0035), so the one they joined with doesn't let them back in.
 */
export async function removeSelfServeMember(academyId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await serverClient();
  const { error } = await db.rpc('admin_remove_member', { p_academy: academyId, p_user: userId });
  if (error) {
    console.error('admin_remove_member', error);
    return { ok: false, error: error.code === 'PGRST202' ? 'Run migration 0033 first.'
      : /not an admin/i.test(error.message) ? 'Only platform admins can do that.'
      : /not a member/i.test(error.message) ? 'They’re not in it any more.'
      : 'Couldn’t remove them. Try again.' };
  }
  revalidatePath(`/admin/academies/${academyId}`);
  return { ok: true };
}

/**
 * Gives an academy free time (0037), or takes it away: the owner's card isn't
 * charged until after that day. Read when they add the card; a card already
 * added keeps the date it was given.
 */
export async function setFreeUntil(id: string, until: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (until !== null && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { ok: false, error: 'Pick a date.' };
  const db = await serverClient();
  const { error } = await db.rpc('admin_set_free_until', { p_academy: id, p_until: until });
  if (error) {
    console.error('admin_set_free_until', error);
    return { ok: false, error: error.code === 'PGRST202' ? 'Run migration 0037 first.'
      : /admins only/i.test(error.message) ? 'Only platform admins can do that.' : 'Couldn’t save that. Try again.' };
  }
  revalidatePath(`/admin/academies/${id}`);
  return { ok: true };
}
