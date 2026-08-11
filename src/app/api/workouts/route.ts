import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';

/** Save a built session to history. This is what makes "order it again" possible. */
export async function POST(req: Request) {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json();
  const { data, error } = await db
    .from('workouts')
    .insert({
      user_id: user.id,
      title: body.title,
      source: body.source ?? 'coach',
      source_ref: body.source_ref ?? null,
      spec: body.spec ?? null,
      exercise_ids: body.exercise_ids ?? [],
      planned_minutes: body.planned_minutes ?? null,
      planned_touches: body.planned_touches ?? null,
      status: body.status ?? 'planned',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (Array.isArray(body.exercise_ids) && body.exercise_ids.length) {
    await db.from('workout_items').insert(
      body.exercise_ids.map((id: string, i: number) => ({
        workout_id: data.id, exercise_id: id, position: i,
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

  const { id, doneIds, actual_minutes, actual_touches } = await req.json();
  const { error } = await db.from('workouts')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      actual_minutes: actual_minutes ?? null,
      actual_touches: actual_touches ?? null,
    })
    .eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (Array.isArray(doneIds) && doneIds.length) {
    await db.from('workout_items')
      .update({ done: true, done_at: new Date().toISOString() })
      .eq('workout_id', id).in('exercise_id', doneIds);
  }
  return NextResponse.json({ ok: true });
}
