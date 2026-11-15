import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { plain } from '@/lib/plain-error';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEELS = ['easy', 'right', 'hard'];
/** Where a session can come from, and what it can be: anything else is stored as the default. */
const SOURCES = ['coach', 'library', 'plan', 'speed', 'academy', 'addon'];
const STATUSES = ['planned', 'in_progress', 'completed'];
const ids = (v: unknown, max: number): string[] =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && x.length <= 100).slice(0, max);
/** A finish time from the phone: kept when it's a real time, not in the future. */
const playedAt = (v: unknown) =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) && Date.parse(v) <= Date.now() + 60_000 ? v : new Date().toISOString();

/** Minutes and touches within reason (0027 checks the same): anything else is dropped. */
const amount = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : null;
const MIN = 600, TOUCHES = 50000;

/** Save a built session to history. This is what makes "order it again" possible. */
export async function POST(req: Request) {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  // Not JSON: a 400, which the phone's queue takes as final. A 500 it sends again for ever.
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const row: Record<string, unknown> = {
      user_id: user.id,
      title: String(body.title ?? '').trim().slice(0, 120) || 'Session',
      source: SOURCES.includes(body.source) ? body.source : 'coach',
      source_ref: typeof body.source_ref === 'string' ? body.source_ref.slice(0, 100) : null,
      spec: body.spec && JSON.stringify(body.spec).length <= 10000 ? body.spec : null,
      exercise_ids: ids(body.exercise_ids, 60),
      planned_minutes: amount(body.planned_minutes, MIN),
      planned_touches: amount(body.planned_touches, TOUCHES),
      status: STATUSES.includes(body.status) ? body.status : 'planned',
      // A session finished in the runner arrives already completed, with what
      // was actually done. completed_at comes from the client because a session
      // finished signed out is sent later, after sign-in — the time it was
      // sent is not the time it was played.
      completed_at: body.status === 'completed' ? playedAt(body.completed_at) : null,
      actual_minutes: amount(body.actual_minutes, MIN),
      actual_touches: amount(body.actual_touches, TOUCHES),
      // Picked on the finish screen while it was waiting for a signal.
      ...(FEELS.includes(body.feel) ? { feel: body.feel } : {}),
  };
  // A trainer's session keeps which drills were ticked on the row itself
  // (0012): progression reads it. Without the column yet, save without it.
  // Speed keeps them too: its drills aren't library rows either, and History
  // needs them to tell a session stopped early from one done in full.
  // A library or built session keeps them on the row as well as in its
  // per-drill items: if those don't write, History still knows a session
  // stopped early from one done in full.
  const ticked = Array.isArray(body.done_ids) && (row.status === 'completed' || body.source === 'academy' || body.source === 'addon' || body.source === 'speed')
    ? ids(body.done_ids, 60) : null;
  // The phone's own id for this finish (0025): a save that reached us but
  // whose answer was lost to the signal is sent again, and must not count twice.
  const clientId = typeof body.client_id === 'string' && UUID.test(body.client_id) ? body.client_id : null;
  if (clientId) row.client_id = clientId;
  const insert = (r: Record<string, unknown>) => db.from('workouts').insert(r).select('id').single();
  let { data, error } = await insert(ticked ? { ...row, done_ids: ticked } : row);
  if (error && ticked && /done_ids/.test(error.message)) ({ data, error } = await insert(row));
  // Before 0025: no client_id column, so save it without.
  if (error && clientId && /client_id/.test(error.message)) {
    delete row.client_id;
    ({ data, error } = await insert(ticked ? { ...row, done_ids: ticked } : row));
    if (error && ticked && /done_ids/.test(error.message)) ({ data, error } = await insert(row));
  }
  // Already saved, the first time it was sent: that one stands.
  if (error && clientId && error.code === '23505') {
    const { data: was } = await db.from('workouts').select('id').eq('user_id', user.id).eq('client_id', clientId).maybeSingle();
    if (was) return NextResponse.json({ id: was.id, again: true });
  }

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'not saved' }, { status: 400 });

  // Speed and trainer drills are not library rows, and workout_items.exercise_id
  // is a foreign key to exercises — so those sessions keep their ids on the
  // workout row (text[], no FK) and skip the per-drill ticks.
  const served = row.exercise_ids as string[];
  if ((row.source === 'library' || row.source === 'coach') && served.length) {
    // Every drill as served, with the ones ticked off marked done — a session
    // ended early still records what it was meant to be.
    const done = new Set<string>(ids(body.done_ids, 60));
    const items = await db.from('workout_items').insert(
      served.map((id: string, i: number) => ({
        workout_id: data.id, exercise_id: id, position: i,
        done: done.has(id), done_at: done.has(id) ? row.completed_at : null,
      }))
    );
    // The session is saved, and its ticks are on the row; the per-drill rows are extra.
    if (items.error) console.error('[workouts] workout_items', items.error.message);
  }
  return NextResponse.json({ id: data.id });
}

/** Mark complete, with what was actually finished. */
export async function PATCH(req: Request) {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  // Not JSON: a 400, which the phone's queue takes as final. A 500 it sends again for ever.
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'bad request' }, { status: 400 });
  // How it felt, after the fact: just that, on a finished session. (A queued
  // finish carries its feel too, with the rest: that's the branch below.)
  if (body.feel !== undefined && body.id && body.actual_minutes === undefined) {
    if (!['easy', 'right', 'hard'].includes(body.feel)) return NextResponse.json({ error: 'feel is easy, right or hard' }, { status: 400 });
    const { error } = await db.from('workouts').update({ feel: body.feel }).eq('id', body.id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const { id, doneIds, actual_minutes, actual_touches } = body;
  // A finish sent later (no signal at the time) keeps the time it was played.
  const at = playedAt(body.completed_at);
  const { data: updated, error } = await db.from('workouts')
    .update({
      status: 'completed',
      completed_at: at,
      actual_minutes: amount(actual_minutes, MIN),
      actual_touches: amount(actual_touches, TOUCHES),
      ...(FEELS.includes(body.feel) ? { feel: body.feel } : {}),
    })
    .eq('id', id).eq('user_id', user.id).select('id');
  if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
  // Nothing matched: removed (on another phone, say) since it was started.
  // Not "saved": the runner saves it as a new session instead.
  if (!updated?.length) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (Array.isArray(doneIds)) {
    const ticked = ids(doneIds, 60);
    // On the row too (see POST), so a finish reads right if the items don't write.
    const kept = await db.from('workouts').update({ done_ids: ticked }).eq('id', id).eq('user_id', user.id);
    if (kept.error) console.error('[workouts] done_ids', kept.error.message);
    if (ticked.length) {
      const items = await db.from('workout_items').update({ done: true, done_at: at }).eq('workout_id', id).in('exercise_id', ticked);
      if (items.error) console.error('[workouts] workout_items', items.error.message);
    }
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
