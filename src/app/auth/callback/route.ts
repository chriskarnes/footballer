import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // A path on this site only. `//evil.com` or `@evil.com` after the origin
  // would send a freshly signed-in player somewhere else.
  const asked = searchParams.get('next') ?? '/';
  const next = /^\/(?!\/)/.test(asked) && !asked.includes('\\') ? asked : '/';
  if (code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/?auth=error`);
}
