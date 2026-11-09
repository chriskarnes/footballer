'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { academyTag } from '@/lib/branding-server';
import { getViewer } from '@/lib/viewer';
import { isHex } from '@/lib/brand-colors';
import { LOGO_MAX_BYTES, LOGO_TYPES, PALETTES } from '@/lib/branding';

type Result = { ok: true } | { ok: false, error: string };

/**
 * Every action re-checks itself. The page hiding the form is a courtesy; a
 * Server Action is a public endpoint. RLS checks it a third time (owner or
 * platform admin), so a bug here fails closed at the database.
 *
 * The academy is the one this request came in on — the subdomain — never an
 * id the browser sends.
 */
async function brandDb() {
  const v = await getViewer();
  if (!v.academy) return { error: 'Open your academy’s own address to brand it.' } as const;
  if (!v.user) return { error: 'Sign in first.' } as const;
  if (!v.canBrand) return { error: 'Only the academy’s owner can change its brand.' } as const;
  return { db: v.db, user: v.user, academy: v.academy } as const;
}

/** Saved, so every page picks it up on its next render — not just this one. */
function published(slug: string) {
  updateTag(academyTag(slug));
  revalidatePath('/', 'layout');
}

type Auth = Exclude<Awaited<ReturnType<typeof brandDb>>, { error: string }>;

async function write(auth: Auth, patch: Record<string, unknown>): Promise<Result> {
  const { error } = await auth.db.from('academies')
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: auth.user.id })
    .eq('id', auth.academy.id);
  if (error) return { ok: false, error: error.message };
  published(auth.academy.slug);
  return { ok: true };
}

export async function saveBranding(input: {
  name: string; paletteId: string | null; primary: string | null; accent: string | null;
}): Promise<Result> {
  const auth = await brandDb();
  if ('error' in auth) return { ok: false, error: auth.error! };

  // An academy always has a name; an empty box keeps the one it has.
  const name = input.name.trim().slice(0, 40) || auth.academy.name;
  // Null colours are "Unbranded" picked in the panel: keep the monochrome
  // scheme, keep the name and logo.
  const colours = input.primary !== null || input.accent !== null;
  if (colours && (!isHex(input.primary) || !isHex(input.accent))) {
    return { ok: false, error: 'Colours must be #RRGGBB.' };
  }
  const paletteId = PALETTES.some((p) => p.id === input.paletteId) ? input.paletteId : null;

  return write(auth, {
    name, palette_id: colours ? paletteId : null,
    primary_color: colours ? input.primary!.toUpperCase() : null,
    accent_color: colours ? input.accent!.toUpperCase() : null,
  });
}

export async function uploadLogo(form: FormData): Promise<Result> {
  const auth = await brandDb();
  if ('error' in auth) return { ok: false, error: auth.error! };

  const file = form.get('logo');
  if (!(file instanceof File) || !file.size) return { ok: false, error: 'Choose an image.' };
  if (!LOGO_TYPES.includes(file.type)) return { ok: false, error: 'Use a PNG, SVG, WebP or JPEG.' };
  if (file.size > LOGO_MAX_BYTES) return { ok: false, error: 'Keep the logo under 512 KB.' };

  const data = Buffer.from(await file.arrayBuffer()).toString('base64');
  return write(auth, { logo_type: file.type, logo_data: data });
}

export async function removeLogo(): Promise<Result> {
  const auth = await brandDb();
  if ('error' in auth) return { ok: false, error: auth.error! };
  return write(auth, { logo_type: null, logo_data: null });
}

/** Back to the monochrome app, logo gone. The academy keeps its name. */
export async function resetBranding(): Promise<Result> {
  const auth = await brandDb();
  if ('error' in auth) return { ok: false, error: auth.error! };
  return write(auth, { palette_id: null, primary_color: null, accent_color: null, logo_type: null, logo_data: null });
}
