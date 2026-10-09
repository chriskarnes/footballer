import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';

/**
 * Saved weeks. A player can keep several — an off-season week and an in-season
 * one, say — and follows one at a time: that's `active`, and it's the week the
 * Plan tab and Train's "today" card read.
 *
 *   POST    a new week, followed unless `follow: false`
 *   PUT     a rebuilt week: same plan, same name, new answers and days
 *   PATCH   rename, or switch which week is followed
 *   DELETE  one week, by ?id=
 */

type Day = { weekday: number; slot: number; kind: string; session_id: string | null };

async function signedIn() {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  return { db, user };
}

const unauthorized = () => NextResponse.json({ error: 'not signed in' }, { status: 401 });

/** A 400 naming the problem beats a check-constraint error surfacing as a failed save. */
function invalid(intake: unknown, days: unknown): NextResponse | null {
  if (!intake || !Array.isArray(days) || !days.length) {
    return NextResponse.json({ error: 'intake and days are required' }, { status: 400 });
  }
  const bad = (days as Day[]).find(
    (d) => typeof d.weekday !== 'number' || d.weekday < 0 || d.weekday > 6 ||
      !['rest', 'technical', 'physical'].includes(d.kind)
  );
  return bad ? NextResponse.json({ error: `invalid day: ${JSON.stringify(bad)}` }, { status: 400 }) : null;
}

const dayRows = (planId: string, days: Day[]) => days.map((d) => ({
  plan_id: planId, weekday: d.weekday, slot: d.slot ?? 0, kind: d.kind, session_id: d.session_id ?? null,
}));

export async function POST(req: Request) {
  const { db, user } = await signedIn();
  if (!user) return unauthorized();

  const { intake, days, name, follow = true } = await req.json();
  const bad = invalid(intake, days);
  if (bad) return bad;

  // Following a new week stops following the old one. The old one is kept —
  // it's a saved plan now, not a retired one.
  if (follow) await db.from('plans').update({ active: false }).eq('user_id', user.id).eq('active', true);

  const { data: plan, error } = await db.from('plans')
    .insert({ user_id: user.id, name: (name || 'My weekly schedule').slice(0, 60), active: !!follow, intake })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Checked: a plan whose days silently failed to write is an empty week that
  // still reports success. Roll the header back so the player is asked again.
  const { error: dayError } = await db.from('plan_days').insert(dayRows(plan.id, days));
  if (dayError) {
    await db.from('plans').delete().eq('id', plan.id);
    return NextResponse.json({ error: dayError.message }, { status: 400 });
  }
  return NextResponse.json({ id: plan.id });
}

/** Rebuild in place. The plan keeps its id, name and followed state, so a week
 *  you renamed and follow is still that week after you change Tuesday. */
export async function PUT(req: Request) {
  const { db, user } = await signedIn();
  if (!user) return unauthorized();

  const { id, intake, days } = await req.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const bad = invalid(intake, days);
  if (bad) return bad;

  const { data: plan, error } = await db.from('plans')
    .update({ intake }).eq('id', id).eq('user_id', user.id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Insert the new days before deleting the old, so a failed write leaves the
  // week as it was rather than empty.
  const { data: old } = await db.from('plan_days').select('id').eq('plan_id', id);
  const { error: dayError } = await db.from('plan_days').insert(dayRows(id, days));
  if (dayError) return NextResponse.json({ error: dayError.message }, { status: 400 });
  if (old?.length) await db.from('plan_days').delete().in('id', old.map((d) => d.id));

  return NextResponse.json({ id });
}

export async function PATCH(req: Request) {
  const { db, user } = await signedIn();
  if (!user) return unauthorized();

  const { id, name, follow } = await req.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  if (typeof name === 'string') {
    const clean = name.trim().slice(0, 60);
    if (!clean) return NextResponse.json({ error: 'name can’t be empty' }, { status: 400 });
    const { error } = await db.from('plans').update({ name: clean }).eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (follow === true) {
    await db.from('plans').update({ active: false }).eq('user_id', user.id).eq('active', true);
    const { error } = await db.from('plans').update({ active: true }).eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { db, user } = await signedIn();
  if (!user) return unauthorized();

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { error } = await db.from('plans').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
