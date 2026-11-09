import { createClient } from '@supabase/supabase-js';
import { getSessions } from '@/lib/library';
import { getAcademy, getBranding } from '@/lib/branding-server';
import { calendar } from '@/lib/ics';
import { feedEvents, type FeedData } from '@/lib/calendar-feed';
import { academyEvents, type AcademyFeed } from '@/lib/calendar-academy';

// Built per fetch: the whole point is that it changes as sessions are done.
export const dynamic = 'force-dynamic';

/**
 * GET /cal/<token>.ics — one player's training as a subscribable calendar.
 *
 * Fetched by Apple, Google and Outlook's servers, so there are no cookies and
 * no session: the token in the URL is the only key. It is looked up through
 * public.calendar_feed, a security-definer function, with the anon key — this
 * route holds no privileged credentials. An unknown token is a plain 404, the
 * same as a revoked one, so a guess learns nothing.
 */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const token = file.replace(/\.ics$/i, '');
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token) || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new Response('Not found', { status: 404 });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc('calendar_feed', { p_token: token });
  if (error || !data) return new Response('Not found', { status: 404 });

  const feed = data as FeedData;
  const { academy } = await getAcademy();
  const [sessions, brand, trainer] = await Promise.all([
    getSessions(), getBranding(),
    // The trainer's week: group training times and the sessions they set.
    // Missing (no academy, or before migration 0007) just means none.
    academy ? Promise.resolve(db.rpc('calendar_academy', { p_token: token, p_slug: academy.slug })).then((r) => r.data as AcademyFeed | null, () => null) : null,
  ]);
  const origin = new URL(req.url).origin;
  const events = feedEvents(feed, sessions, origin);
  if (trainer) events.push(...academyEvents(trainer, feed.completed, origin, trainer.time_zone || feed.time_zone));
  const body = calendar(`${brand?.name ?? 'Train.futbol'} training`, events);

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="training.ics"',
      // Short, so a calendar that does refresh often sees a tick soon after it
      // is earned; private, because the body is one player's schedule.
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex',
    },
  });
}
