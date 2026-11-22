import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The database with the server's own key, which passes row-level security:
 * for what nobody signed in may write (a parent's agreement, the daily
 * clean-up). Null until SUPABASE_SERVICE_ROLE_KEY is set.
 */
export function serviceDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/** A table or column that a migration hasn't made yet: read as "nothing there". */
export const notMadeYet = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42703' || e.code === 'PGRST204'
    || /does not exist|could not find/i.test(e.message ?? ''));
