import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { plain } from '@/lib/plain-error';

/** Save a built session to history. This is what makes "order it again" possible. */
export async function POST(req: Request) {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json();
  const row: Record<string, unknown> = {
      user_id: user.id,
      title: body.title,
      source: body.source ?? 'coach',
      source_ref: body.source_ref ?? null,
      spec: body.spec ?? null,
      exercise_ids: body.exercise_ids ?? [],
      planned_minutes: body.planned_minutes ?? null,
      planned_touches: body.planned_touches ?? null,
      status: body.status ?? 'planned',
      // A session finished in the runner arrives already completed, with what
      // was actually done. completed_at comes from the client because a session
      // finished signed out is sent later, after sign-in — the time it was
      // sent is not the time it was played.
      completed_at: body.status === 'completed' ? (body.completed_at ?? new Date().toISOString()) : null,
      actual_minutes: body.actual_minutes ?? null,
      actual_touches: body.actual_touches ?? null,
  };
  // A trainer's session keeps which drills were ticked on the row itself
  // (0012): progression reads it. Without the column yet, save without it.
  const ticked = (body.source === 'academy' || body.source === 'addon') && Array.isArray(body.done_ids)
    ? body.done_ids.filter((x: unknown) => typeof x === 'string').slice(0, 40) : null;
  let { data, error } = await db.from('workouts').insert(ticked ? { ...row, done_ids: ticked } : row).select('id').single();
  if (error && ticked && /done_ids/.test(error.message)) ({ data, error } = await db.from('workouts').insert(row).select('id').single());

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'not saved' }, { status: 400 });

  // Speed and trainer drills are not library rows, and workout_items.exercise_id
  // is a foreign key to exercises — so those sessions keep their ids on the
  // workout row (text[], no FK) and skip the per-drill ticks.
  if ((body.source === 'library' || body.source === 'coach' || !body.source) && Array.isArray(body.exercise_ids) && body.exercise_ids.length) {
    // Every drill as served, with the ones ticked off marked done — a session
    // ended early still records what it was meant to be.
    const done = new Set<string>(Array.isArray(body.done_ids) ? body.done_ids : []);
    await db.from('workout_items').insert(
      body.exercise_ids.map((id: string, i: number) => ({
        workout_id: data.id, exercise_id: id, position: i,
        done: done.has(id), done_at: done.has(id) ? (body.completed_at ?? new Date().toISOString()) : null,
      }))
    );
  }
  return NextResponse.json({ id: data.id });
}

/** Mark complete, with what was actually finished. */
export async function PATCH(req: Request) {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json();
  // How it felt, after the fact: just that, on a finished session.
  if (body.feel !== undefined && body.id) {
    if (!['easy', 'right', 'hard'].includes(body.feel)) return NextResponse.json({ error: 'feel is easy, right or hard' }, { status: 400 });
    const { error } = await db.from('workouts').update({ feel: body.feel }).eq('id', body.id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const { id, doneIds, actual_minutes, actual_touches } = body;
  const { error } = await db.from('workouts')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      actual_minutes: actual_minutes ?? null,
      actual_touches: actual_touches ?? null,
    })
    .eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });

  if (Array.isArray(doneIds) && doneIds.length) {
    await db.from('workout_items')
      .update({ done: true, done_at: new Date().toISOString() })
      .eq('workout_id', id).in('exercise_id', doneIds);
  }
  return NextResponse.json({ ok: true });
}

/** Remove a saved session — the ones kept from Train to do later. A finished
 *  session is history and isn't deleted from here. */
export async function DELETE(req: Request) {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { error } = await db.from('workouts').delete()
    .eq('id', id).eq('user_id', user.id).neq('status', 'completed');
  if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
