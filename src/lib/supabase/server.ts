import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side client. Kept in its own file so `next/headers` never reaches the
 * browser bundle — importing it from a Client Component is a build error, by design.
 * Async because Next 16 made cookies() async: always `await serverClient()`.
 */
export const serverClient = async () => {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // called from a Server Component; token refresh happens in middleware
          }
        },
      },
    }
  );
};
