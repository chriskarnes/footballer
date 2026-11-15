import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { plain } from '@/lib/plain-error';

/**
 * Saved weeks. A player can keep several — an off-season week and an in-season
 * one, say — and one at a time is active: the week the Plan tab and Train's
 * "today" card read. (`follow` in the bodies below means "make active"; the
 * word predates the Active/Inactive naming.)
 *
 *   POST    a new week, made active unless `follow: false`
 *   PUT     a rebuilt week: same plan, same name, new answers and days
 *   PATCH   rename, or switch which week is active
 *   DELETE  one week, by ?id=
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (JSON.stringify(intake).length > 10000 || days.length > 21) {
    return NextResponse.json({ error: 'That plan is too large.' }, { status: 400 });
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

/**
 * Makes one of the player's plans the active one, and every other inactive,
 * in one step (activate_plan, 0027): never none active, never two. true when
 * done, null when there's no such plan, else what went wrong.
 */
async function activate(db: Awaited<ReturnType<typeof signedIn>>['db'], userId: string, id: string): Promise<true | null | string> {
  const { data, error } = await db.rpc('activate_plan', { p_plan: id });
  if (!error) return data ? true : null;
  if (error.code !== 'PGRST202') return plain(error);
  // Before 0027: the new one first, then the others off.
  const { data: on, error: e1 } = await db.from('plans').update({ active: true }).eq('id', id).eq('user_id', userId).select('id');
  if (e1) return plain(e1);
  if (!on?.length) return null;
  await db.from('plans').update({ active: false }).eq('user_id', userId).eq('active', true).neq('id', id);
  return true;
}

export async function POST(req: Request) {
  const { db, user } = await signedIn();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'intake and days are required' }, { status: 400 });
  const { intake, days, follow = true } = body;
  const name = typeof body.name === 'string' ? body.name : '';
  const bad = invalid(intake, days);
  if (bad) return bad;
  // The phone's own id for this save (0035): one whose answer was lost to
  // the signal, or sent from two tabs, is sent again and must be one week.
  const clientId = typeof body.client_id === 'string' && UUID.test(body.client_id) ? body.client_id : null;
  const finish = async (id: string) => {
    if (follow) {
      const made = await activate(db, user.id, id);
      if (made !== true) return NextResponse.json({ error: 'Saved, but couldn’t make it your active week. Try again.' }, { status: 400 });
    }
    return NextResponse.json({ id });
  };

  // Written inactive, days and all, and only then made the active one: a
  // failure part-way leaves the old week active, not none.
  const row: Record<string, unknown> = { user_id: user.id, name: (name || 'My weekly schedule').slice(0, 60), active: false, intake };
  let { data: plan, error } = await db.from('plans').insert(clientId ? { ...row, client_id: clientId } : row).select('id').single();
  // Before 0035 there's no client_id column: saved without it.
  if (error && clientId && error.code !== '23505' && /client_id/.test(error.message)) {
    ({ data: plan, error } = await db.from('plans').insert(row).select('id').single());
  }
  // Already saved, the first time it was sent: that one stands. Made active
  // again in case that was the step that failed.
  if (error && clientId && error.code === '23505') {
    const { data: was } = await db.from('plans').select('id').eq('user_id', user.id).eq('client_id', clientId).maybeSingle();
    if (was) return finish(was.id);
  }
  if (error || !plan) return NextResponse.json({ error: error ? plain(error) : 'not saved' }, { status: 400 });

  // Checked: a plan whose days silently failed to write is an empty week that
  // still reports success. Roll the header back so the player is asked again.
  const { error: dayError } = await db.from('plan_days').insert(dayRows(plan.id, days));
  if (dayError) {
    await db.from('plans').delete().eq('id', plan.id);
    return NextResponse.json({ error: dayError.message }, { status: 400 });
  }
  // Making a new week active makes the old one inactive. It's kept — an
  // inactive plan, not a retired one.
  return finish(plan.id);
}

/** Rebuild in place. The plan keeps its id, name and active state, so a week
 *  you renamed and made active is still that week after you change Tuesday. */
export async function PUT(req: Request) {
  const { db, user } = await signedIn();
  if (!user) return unauthorized();

  const { id, intake, days } = (await req.json().catch(() => null)) ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const bad = invalid(intake, days);
  if (bad) return bad;

  const { data: plan, error } = await db.from('plans')
    .update({ intake }).eq('id', id).eq('user_id', user.id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
  if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Insert the new days before deleting the old, so a failed write leaves the
  // week as it was rather than empty.
  const { data: old, error: oldError } = await db.from('plan_days').select('id').eq('plan_id', id);
  // Not known which days are the old ones: adding the new would double the week.
  if (oldError) return NextResponse.json({ error: plain(oldError) }, { status: 400 });
  const { data: added, error: dayError } = await db.from('plan_days').insert(dayRows(id, days)).select('id');
  if (dayError) return NextResponse.json({ error: dayError.message }, { status: 400 });
  if (old?.length) {
    const { error: delError } = await db.from('plan_days').delete().in('id', old.map((d) => d.id));
    // The old days are still there: take the new ones back out, so the week
    // is as it was rather than doubled, and say it didn't save.
    if (delError) {
      if (added?.length) await db.from('plan_days').delete().in('id', added.map((d) => d.id));
      return NextResponse.json({ error: plain(delError) }, { status: 400 });
    }
  }

  return NextResponse.json({ id });
}

export async function PATCH(req: Request) {
  const { db, user } = await signedIn();
  if (!user) return unauthorized();

  const { id, name, follow } = (await req.json().catch(() => null)) ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  if (typeof name === 'string') {
    const clean = name.trim().slice(0, 60);
    if (!clean) return NextResponse.json({ error: 'name can’t be empty' }, { status: 400 });
    const { error } = await db.from('plans').update({ name: clean }).eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
  }

  if (follow === true) {
    const made = await activate(db, user.id, id);
    if (made === null) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (made !== true) return NextResponse.json({ error: made }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { db, user } = await signedIn();
  if (!user) return unauthorized();

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { error } = await db.from('plans').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: plain(error) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
