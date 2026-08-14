import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';

/**
 * The weekly blueprint. One active plan per player: saving a new one retires the
 * old rather than accumulating a drawer of half-abandoned weeks.
 */
export async function POST(req: Request) {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { intake, days, name } = await req.json();

  if (!intake || !Array.isArray(days) || !days.length) {
    return NextResponse.json({ error: 'intake and days are required' }, { status: 400 });
  }
  // The check constraint on plan_days would catch this, but a 400 naming the
  // problem beats a Postgres error surfacing as a failed save.
  const bad = days.find(
    (d: { weekday: number; slot: number; kind: string }) =>
      typeof d.weekday !== 'number' || d.weekday < 0 || d.weekday > 6 ||
      !['rest', 'technical', 'physical'].includes(d.kind)
  );
  if (bad) return NextResponse.json({ error: `invalid day: ${JSON.stringify(bad)}` }, { status: 400 });

  // Retire the previous week first. If the insert below fails the player is left
  // with no active plan rather than two, which is the safer of the two wrong
  // answers — the screen then offers to build one instead of showing a stale week.
  await db.from('plans').update({ active: false }).eq('user_id', user.id).eq('active', true);

  const { data: plan, error } = await db
    .from('plans')
    .insert({
      user_id: user.id,
      name: name || 'My weekly schedule',
      active: true,
      intake,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: dayError } = await db.from('plan_days').insert(
    days.map((d: { weekday: number; slot: number; kind: string; session_id: string | null }) => ({
      plan_id: plan.id,
      weekday: d.weekday,
      slot: d.slot ?? 0,
      kind: d.kind,
      session_id: d.session_id ?? null,
    }))
  );

  // Checked, unlike the equivalent insert in /api/workouts: a plan whose days
  // silently failed to write is an empty week that still reports success. Roll
  // the header back so the player is asked to build again rather than shown one.
  if (dayError) {
    await db.from('plans').delete().eq('id', plan.id);
    return NextResponse.json({ error: dayError.message }, { status: 400 });
  }

  return NextResponse.json({ id: plan.id });
}

/** Drop the active plan — "start again" on the blueprint screen. */
export async function DELETE() {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { error } = await db.from('plans')
    .delete().eq('user_id', user.id).eq('active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
