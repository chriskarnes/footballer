'use server';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '@/lib/avatar';
import { plain } from '@/lib/plain-error';

type Result = { ok: true; updatedAt: string | null } | { ok: false; error: string };

async function write(patch: { avatar_type: string | null; avatar_data: string | null }): Promise<Result> {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in first.' };
  const updatedAt = patch.avatar_data ? new Date().toISOString() : null;
  // Upsert, not update: a player can add a photo before they've answered anything else.
  const { error } = await db.from('profiles').upsert({ id: user.id, ...patch, avatar_updated_at: updatedAt });
  if (error) {
    const missing = error.code === 'PGRST204' || /column .* does not exist/i.test(error.message);
    return { ok: false, error: missing ? 'Photos aren’t switched on yet. Try again later.' : plain(error) };
  }
  revalidatePath('/me', 'layout');
  return { ok: true, updatedAt };
}

/** Save a photo the browser has already cropped and shrunk. */
export async function uploadAvatar(form: FormData): Promise<Result> {
  const file = form.get('avatar');
  if (!(file instanceof File) || !file.size) return { ok: false, error: 'Choose a photo.' };
  if (!AVATAR_TYPES.includes(file.type)) return { ok: false, error: 'Use a JPEG, PNG or WebP.' };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: 'That photo is too large.' };
  return write({ avatar_type: file.type, avatar_data: Buffer.from(await file.arrayBuffer()).toString('base64') });
}

export async function removeAvatar(): Promise<Result> {
  return write({ avatar_type: null, avatar_data: null });
}
