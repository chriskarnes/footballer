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
