'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { BRANDING_TAG } from '@/lib/branding-server';
import { isHex } from '@/lib/brand-colors';
import { LOGO_MAX_BYTES, LOGO_TYPES, PALETTES } from '@/lib/branding';

type Result = { ok: true } | { ok: false, error: string };

/**
 * Every action re-checks admin itself. The page hiding the form is a courtesy;
 * a Server Action is a public endpoint. RLS checks it a third time, so a bug
 * here fails closed at the database rather than open.
 */
async function adminDb() {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Sign in first.' } as const;
  const { data } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!data) return { error: 'This account is not an admin.' } as const;
  return { db, user } as const;
}

/** Saved, so every page picks it up on its next render — not just this one. */
function published() {
  updateTag(BRANDING_TAG);
  revalidatePath('/', 'layout');
}

export async function saveBranding(input: {
  name: string; paletteId: string | null; primary: string | null; accent: string | null;
}): Promise<Result> {
  const auth = await adminDb();
  if ('error' in auth) return { ok: false, error: auth.error! };

  const name = input.name.trim().slice(0, 40) || null;
  // Null colours are "Unbranded" picked in the panel: keep the monochrome
  // scheme, keep any name and logo.
  const colours = input.primary !== null || input.accent !== null;
  if (colours && (!isHex(input.primary) || !isHex(input.accent))) {
    return { ok: false, error: 'Colours must be #RRGGBB.' };
  }
  const paletteId = PALETTES.some((p) => p.id === input.paletteId) ? input.paletteId : null;

  const { error } = await auth.db.from('branding').update({
    enabled: true, name, palette_id: colours ? paletteId : null,
    primary_color: colours ? input.primary!.toUpperCase() : null,
    accent_color: colours ? input.accent!.toUpperCase() : null,
    updated_at: new Date().toISOString(), updated_by: auth.user.id,
  }).eq('id', 1);
  if (error) return { ok: false, error: error.message };
  published();
  return { ok: true };
}

export async function uploadLogo(form: FormData): Promise<Result> {
  const auth = await adminDb();
  if ('error' in auth) return { ok: false, error: auth.error! };

  const file = form.get('logo');
  if (!(file instanceof File) || !file.size) return { ok: false, error: 'Choose an image.' };
  if (!LOGO_TYPES.includes(file.type)) return { ok: false, error: 'Use a PNG, SVG, WebP or JPEG.' };
  if (file.size > LOGO_MAX_BYTES) return { ok: false, error: 'Keep the logo under 512 KB.' };

  const data = Buffer.from(await file.arrayBuffer()).toString('base64');
  const { error } = await auth.db.from('branding').update({
    enabled: true, logo_type: file.type, logo_data: data,
    updated_at: new Date().toISOString(), updated_by: auth.user.id,
  }).eq('id', 1);
  if (error) return { ok: false, error: error.message };
  published();
  return { ok: true };
}

export async function removeLogo(): Promise<Result> {
  const auth = await adminDb();
  if ('error' in auth) return { ok: false, error: auth.error! };
  const { error } = await auth.db.from('branding').update({
    logo_type: null, logo_data: null, updated_at: new Date().toISOString(), updated_by: auth.user.id,
  }).eq('id', 1);
  if (error) return { ok: false, error: error.message };
  published();
  return { ok: true };
}

/** Back to the unbranded app. Everything is cleared, not just switched off. */
export async function resetBranding(): Promise<Result> {
  const auth = await adminDb();
  if ('error' in auth) return { ok: false, error: auth.error! };
  const { error } = await auth.db.from('branding').update({
    enabled: false, name: null, palette_id: null, primary_color: null, accent_color: null,
    logo_type: null, logo_data: null, updated_at: new Date().toISOString(), updated_by: auth.user.id,
  }).eq('id', 1);
  if (error) return { ok: false, error: error.message };
  published();
  return { ok: true };
}
