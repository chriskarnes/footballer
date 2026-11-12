import { getAcademy } from '@/lib/branding-server';
import { serverClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * This academy's trainer's photo, for its own members (0018 checks that).
 * Asked for with `?v=<avatar_updated_at>`, so an address never changes
 * content; cached in the member's browser only, never by a shared cache.
 */
export async function GET() {
  const { academy } = await getAcademy();
  if (!academy) return new Response(null, { status: 404 });
  const db = await serverClient();
  const { data, error } = await db.rpc('academy_trainer_photo', { p_academy: academy.id });
  const photo = data as { type: string; data: string } | null;
  if (error || !photo?.type || !photo.data) return new Response(null, { status: 404 });
  return new Response(Buffer.from(photo.data, 'base64'), {
    headers: {
      'Content-Type': photo.type,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
