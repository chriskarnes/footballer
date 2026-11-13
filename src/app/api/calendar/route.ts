import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { serverClient } from '@/lib/supabase/server';
import { validZone } from '@/lib/calendar-feed';
import { plain } from '@/lib/plain-error';

/**
 * The signed-in player's calendar feed settings.
 *
 *   POST    turn it on (or, with { reset: true }, replace the link)
 *   PATCH   change what it includes, the start time, the zone
 *   DELETE  turn it off — the row and its link are gone
 *
 * The token is 32 random bytes, base64url: unguessable, and the only thing a
 * calendar server ever presents.
 */
const newToken = () => randomBytes(32).toString('base64url');
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

async function me() {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  return { db, user };
}

export async function POST(req: Request) {
  const { db, user } = await me();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const zone = typeof body.time_zone === 'string' && validZone(body.time_zone) ? body.time_zone : 'UTC';

  const { data, error } = body.reset
    ? await db.from('calendar_feeds').update({ token: newToken(), updated_at: new Date().toISOString() })
        .eq('user_id', user.id).select().single()
    : await db.from('calendar_feeds').upsert({ user_id: user.id, token: newToken(), time_zone: zone })
        .select().single();
  if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { db, user } = await me();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.include_plan === 'boolean') patch.include_plan = body.include_plan;
  if (typeof body.include_speed === 'boolean') patch.include_speed = body.include_speed;
  if (body.start_time === null || (typeof body.start_time === 'string' && TIME.test(body.start_time))) {
    patch.start_time = body.start_time;
  }
  if (typeof body.time_zone === 'string' && validZone(body.time_zone)) patch.time_zone = body.time_zone;

  const { data, error } = await db.from('calendar_feeds').update(patch).eq('user_id', user.id).select().single();
  if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE() {
  const { db, user } = await me();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  const { error } = await db.from('calendar_feeds').delete().eq('user_id', user.id);
  if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
