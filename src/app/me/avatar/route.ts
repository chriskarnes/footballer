import { serverClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * The signed-in player's own photo. Asked for with `?v=<avatar_updated_at>`,
 * so an address never changes content; cached in their browser only, since it
 * is theirs and nobody else's.
 */
export async function GET() {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response(null, { status: 404 });
  // Before migration 0016 the columns aren't there: that's an error, read as no photo.
  const { data } = await db.from('profiles').select('avatar_type, avatar_data').eq('id', user.id).maybeSingle();
  const row = data as { avatar_type: string | null; avatar_data: string | null } | null;
  if (!row?.avatar_type || !row.avatar_data) return new Response(null, { status: 404 });
  return new Response(Buffer.from(row.avatar_data, 'base64'), {
    headers: {
      'Content-Type': row.avatar_type,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
