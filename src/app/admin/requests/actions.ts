'use server';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';

export type Approved = { ok: true; slug: string; code: string } | { ok: false; error: string };

/**
 * Makes the academy for a "Get started" request, unlisted and with no owner,
 * and returns the code for the trainer's claim link. Platform admins only;
 * the database checks. Approving twice returns the first approval's link.
 */
export async function approveRequest(id: string, slug: string, name: string): Promise<Approved> {
  const s = slug.trim().toLowerCase(), n = name.trim();
  if (!/^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$/.test(s)) {
    return { ok: false, error: 'Use 3 to 30 lowercase letters, numbers and hyphens, starting and ending with a letter or number.' };
  }
  if (!n || n.length > 40) return { ok: false, error: 'Give the academy a name of up to 40 characters.' };

  const db = await serverClient();
  const { data, error } = await db.rpc('approve_academy_request', { p_request: id, p_slug: s, p_name: n });
  if (error) {
    const m = error.message;
    return {
      ok: false,
      error: /address taken|duplicate key/.test(m) ? `${s}.train.futbol is taken. Pick another address.`
        : /check constraint/.test(m) ? `${s} is kept for the platform. Pick another address.`
        : /not an admin/.test(m) ? 'Only platform admins can approve.'
        : /function .* does not exist|Could not find the function/i.test(m) ? 'Run migration 0020 in Supabase first.'
        : m,
    };
  }
  revalidatePath('/admin/requests');
  const r = data as { slug: string; code: string };
  return { ok: true, slug: r.slug, code: r.code };
}
