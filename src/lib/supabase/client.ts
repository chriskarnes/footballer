import { createBrowserClient } from '@supabase/ssr';

/** Browser-side client. Safe to import from Client Components. */
export const browserClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
