import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { toBranding, type Branding, type BrandingRow } from './branding';

export const BRANDING_TAG = 'branding';
export const ROW_COLUMNS = 'enabled, name, palette_id, primary_color, accent_color, logo_type, updated_at';

/**
 * A cookie-less client: the brand is public, and reading it with the visitor's
 * session would make every page dynamic for no reason.
 */
const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

/**
 * Read on every page by the root layout, so it is cached until an admin saves
 * (the save calls updateTag). Any failure — no keys, no migration — is the
 * unbranded app, never an error page.
 *
 * The five minutes is a backstop, not the mechanism: a cached "no brand" from
 * before the migration ran, or a row edited in the SQL editor, would otherwise
 * never be read again, since only a save through /admin expires the tag.
 */
export const getBranding = unstable_cache(
  async (): Promise<Branding | null> => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
    try {
      const { data, error } = await anon().from('branding').select(ROW_COLUMNS).eq('id', 1).maybeSingle();
      if (error) return null;
      return toBranding(data as BrandingRow | null);
    } catch {
      return null;
    }
  },
  ['branding'],
  { tags: [BRANDING_TAG], revalidate: 300 },
);

export const getLogo = unstable_cache(
  async (): Promise<{ type: string; data: string } | null> => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
    const { data } = await anon().from('branding').select('enabled, logo_type, logo_data').eq('id', 1).maybeSingle();
    if (!data?.enabled || !data.logo_type || !data.logo_data) return null;
    return { type: data.logo_type, data: data.logo_data };
  },
  ['branding-logo'],
  { tags: [BRANDING_TAG], revalidate: 300 },
);
