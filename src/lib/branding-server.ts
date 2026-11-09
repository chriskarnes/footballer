import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { toBranding, type Branding } from './branding';
import { slugFromHost } from './tenant';

export const ACADEMY_COLUMNS = 'id, slug, name, time_zone, palette_id, primary_color, accent_color, logo_type, updated_at, library_access';
export const academyTag = (slug: string) => `academy:${slug}`;

export type Academy = {
  id: string; slug: string; name: string; timeZone: string;
  branding: Branding;
  /** Sees the licensed drill library. Only `demo`; see migration 0005. */
  libraryAccess: boolean;
};

type AcademyRow = {
  id: string; slug: string; name: string; time_zone: string; palette_id: string | null;
  primary_color: string | null; accent_color: string | null; logo_type: string | null; updated_at: string;
  library_access: boolean;
};

/**
 * A cookie-less client: an academy's face is public, and reading it with the
 * visitor's session would tie the cache to them for no reason.
 */
const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

export function toAcademy(row: AcademyRow): Academy {
  return {
    id: row.id, slug: row.slug, name: row.name, timeZone: row.time_zone,
    branding: toBranding({ ...row, enabled: true })!,
    libraryAccess: row.library_access === true,
  };
}

/**
 * Cached per academy until its owner saves (the save calls updateTag). The
 * five minutes is a backstop for a row edited in the SQL editor.
 * `undefined` is "couldn't ask" (no keys, no migration); `null` is "asked,
 * and there's no academy by that name".
 */
const fetchAcademy = (slug: string) => unstable_cache(
  async (): Promise<Academy | null | undefined> => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return undefined;
    try {
      const { data, error } = await anon().from('academies').select(ACADEMY_COLUMNS).eq('slug', slug).maybeSingle();
      if (error) return undefined;
      return data ? toAcademy(data as AcademyRow) : null;
    } catch {
      return undefined;
    }
  },
  ['academy', slug],
  { tags: [academyTag(slug)], revalidate: 300 },
)();

/** The subdomain this request came in on, if it names one. */
export async function currentSlug(): Promise<string | null> {
  const h = await headers();
  return slugFromHost(h.get('x-forwarded-host') ?? h.get('host') ?? '');
}

/**
 * This request's academy. Once per render, however many components ask.
 *   { slug: null }                 the bare domain: the unbranded app
 *   { slug, academy: Academy }     an academy
 *   { slug, academy: null }        a subdomain nobody has claimed
 *   { slug, academy: undefined }   couldn't tell; treated as the unbranded app
 */
export const getAcademy = cache(async (): Promise<{ slug: string | null; academy: Academy | null | undefined }> => {
  const slug = await currentSlug();
  if (!slug) return { slug: null, academy: undefined };
  return { slug, academy: await fetchAcademy(slug) };
});

/** The brand for this request, or null for the unbranded app. */
export async function getBranding(): Promise<Branding | null> {
  return (await getAcademy()).academy?.branding ?? null;
}

export async function getLogo(): Promise<{ type: string; data: string } | null> {
  const slug = await currentSlug();
  if (!slug || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return unstable_cache(
    async () => {
      const { data } = await anon().from('academies').select('logo_type, logo_data').eq('slug', slug).maybeSingle();
      if (!data?.logo_type || !data.logo_data) return null;
      return { type: data.logo_type as string, data: data.logo_data as string };
    },
    ['academy-logo', slug],
    { tags: [academyTag(slug)], revalidate: 300 },
  )();
}

/**
 * Whether this request may see the drill library. Everything in it except
 * Speed is licensed for the demo academy only, so it's an academy switched on
 * in the database — never the bare domain, a preview URL or an unknown
 * subdomain. Local development without a subdomain keeps it, so plain
 * localhost:3000 still works.
 */
export async function libraryAllowed(): Promise<boolean> {
  const { slug, academy } = await getAcademy();
  if (academy) return academy.libraryAccess;
  return !slug && process.env.NODE_ENV === 'development';
}
