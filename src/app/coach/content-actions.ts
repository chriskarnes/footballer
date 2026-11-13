'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { mondayOf, localDate } from '@/lib/progress';
import { FOCUS_LABELS } from '@/lib/types';
import type { DrillRow } from '@/lib/academy-week';
import { plain, notReady, Said } from '@/lib/plain-error';

/**
 * Writes for the trainer's own content (drills, programs, sessions), groups,
 * and what each player is given. RLS checks staff on every row; these check
 * it first so the error is a sentence, and always use the academy this
 * request came in on.
 */
async function staff() {
  const v = await getViewer();
  if (!v.academy || !v.user || !v.staff) throw new Said('Only trainers can do that.');
  return v as typeof v & { academy: NonNullable<typeof v.academy>; user: NonNullable<typeof v.user> };
}

type Result = { ok: true; id?: string; drill?: DrillRow } | { ok: false; error: string };

type Staff = Awaited<ReturnType<typeof staff>>;
/**
 * Ids that came from the browser and are written into another row: each must
 * be this academy's own. RLS checks the row being written belongs here, not
 * what it points at, so a program or drill from another academy could be
 * linked in.
 */
async function ownProgram(v: Staff, id: string) {
  const { data, error } = await v.db.from('academy_programs').select('id').eq('id', id).eq('academy_id', v.academy.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Said('That program isn’t in your academy any more.');
}
async function ownDrills(v: Staff, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const { data, error } = await v.db.from('drills').select('id').eq('academy_id', v.academy.id).in('id', unique);
  if (error) throw error;
  if ((data ?? []).length !== unique.length) throw new Said('One of those drills isn’t in your academy any more. Reload and try again.');
}
const fail = (e: unknown): Result => ({ ok: false, error: plain(e) });
const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);
const done = () => revalidatePath('/', 'layout');
/** The page a save lands on, marked so it says "Saved." (coach/Toast). Before any #hash. */
const withSaved = (url: string) => {
  const [path, hash] = url.split('#');
  return `${path}${path.includes('?') ? '&' : '?'}saved=1${hash ? `#${hash}` : ''}`;
};

/** YouTube and other links are kept as given, if they're https. */
function videoUrl(raw: string): string | null {
  if (!raw) return null;
  const url = raw.startsWith('http') ? raw : `https://${raw}`;
  try { const u = new URL(url); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; }
}

// ------------------------------------------------------------------ DRILLS ---
export async function saveDrill(_: unknown, f: FormData): Promise<Result> {
  try {
    const v = await staff();
    const id = str(f, 'id', 40);
    // Known focus areas only, once each, in the order picked.
    const tags = [...new Set(f.getAll('focus').map(String))].filter((t) => t in FOCUS_LABELS).slice(0, 3);
    const row: {
      academy_id: string; name: string; amount: string | null; minutes: number; focus: string | null;
      focus_areas: string[]; video_url: string | null; how: string | null; harder_id?: string | null;
    } = {
      academy_id: v.academy.id,
      name: str(f, 'name', 80),
      amount: str(f, 'amount', 80) || null,
      minutes: Math.max(1, Math.min(120, Number(f.get('minutes')) || 5)),
      focus: tags[0] ?? null,
      focus_areas: tags,
      video_url: videoUrl(str(f, 'video_url', 300)),
      how: str(f, 'how', 1000) || null,
    };
    // Only from a form that offered the field, so other saves leave it be.
    if (f.get('has_harder')) {
      const h = str(f, 'harder_id', 40);
      row.harder_id = h && h !== id ? h : null;
      if (row.harder_id) await ownDrills(v, [row.harder_id]);
    }
    if (!row.name) return { ok: false, error: 'Give the drill a name.' };
    if (str(f, 'video_url', 300) && !row.video_url) return { ok: false, error: 'That video link doesn’t look right.' };
    const write = (r: Partial<typeof row>) => id
      ? v.db.from('drills').update(r).eq('id', id).eq('academy_id', v.academy.id).select('id').single()
      : v.db.from('drills').insert({ ...r, created_by: v.user.id }).select('id').single();
    let { data, error } = await write(row);
    // Before migration 0008 there's no focus_areas column: keep the main one.
    // Before 0012 there's no harder_id column.
    if (error && /harder_id/.test(error.message)) {
      delete row.harder_id;
      ({ data, error } = await write(row));
    }
    if (error && /focus_areas/.test(error.message)) {
      const { focus_areas: _tags, harder_id: _h, ...plain } = row;
      ({ data, error } = await write(plain));
    }
    if (error) return { ok: false, error: plain(error) };
    done();
    const back = str(f, 'back', 200);
    // A new drill from the Drills page goes to its own page, which offers to
    // put it in sessions.
    if (!id && back === '/coach/drills' && data?.id) redirect(withSaved(`/coach/drills/${data.id}?new=1`));
    if (back.startsWith('/coach')) redirect(withSaved(back));
    // No back: saved from inside another editor, which takes the drill as is.
    return { ok: true, id: data?.id, drill: data?.id ? {
      id: data.id, name: row.name, amount: row.amount, minutes: row.minutes, focus: row.focus,
      focus_areas: row.focus_areas, video_url: row.video_url, how: row.how,
    } : undefined };
  } catch (e) { if (isRedirect(e)) throw e; return fail(e); }
}

export async function deleteDrill(id: string): Promise<Result> {
  try {
    const v = await staff();
    // In one step on the database: out of every session, then gone (0023).
    const { error } = await v.db.rpc('delete_drill', { p_drill: id });
    if (error) {
      const only = /only drill in: (.+)/.exec(error.message)?.[1];
      if (only) return { ok: false, error: `It’s the only drill in ${only}. Add another drill there first, or delete that session.` };
      return { ok: false, error: /function .* does not exist|Could not find the function/i.test(error.message) ? notReady(error, '0023') : plain(error) };
    }
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

// ---------------------------------------------------------------- PROGRAMS ---
export async function saveProgram(_: unknown, f: FormData): Promise<Result> {
  try {
    const v = await staff();
    const id = str(f, 'id', 40);
    const row = {
      academy_id: v.academy.id,
      name: str(f, 'name', 60),
      description: str(f, 'description', 500) || null,
      weeks: Math.max(1, Math.min(52, Number(f.get('weeks')) || 8)),
    };
    if (!row.name) return { ok: false, error: 'Give the program a name.' };
    const q = id
      ? v.db.from('academy_programs').update(row).eq('id', id).eq('academy_id', v.academy.id).select('id').single()
      : v.db.from('academy_programs').insert(row).select('id').single();
    const { data, error } = await q;
    if (error) return { ok: false, error: plain(error) };
    done();
    redirect(withSaved(`/coach/programs/${data.id}`));
  } catch (e) { if (isRedirect(e)) throw e; return fail(e); }
}

export async function deleteProgram(id: string): Promise<Result> {
  try {
    const v = await staff();
    const { error } = await v.db.from('academy_programs').delete().eq('id', id).eq('academy_id', v.academy.id);
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

// ---------------------------------------------------------------- SESSIONS ---
export async function saveSession(input: { id?: string; programId: string; week: number; name: string; drillIds: string[] }): Promise<Result> {
  try {
    const v = await staff();
    const name = input.name.trim().slice(0, 60);
    if (!name) return { ok: false, error: 'Give the session a name.' };
    if (!input.drillIds.length) return { ok: false, error: 'Add at least one drill.' };
    await ownProgram(v, input.programId);
    await ownDrills(v, input.drillIds.slice(0, 30));
    const row = { academy_id: v.academy.id, program_id: input.programId, week: input.week, name, drill_ids: input.drillIds.slice(0, 30) };
    let error;
    if (input.id) {
      ({ error } = await v.db.from('academy_sessions').update(row).eq('id', input.id).eq('academy_id', v.academy.id));
    } else {
      const { count } = await v.db.from('academy_sessions').select('id', { count: 'exact', head: true })
        .eq('program_id', input.programId).eq('week', input.week);
      ({ error } = await v.db.from('academy_sessions').insert({ ...row, position: count ?? 0 }));
    }
    if (error) return { ok: false, error: plain(error) };
    done();
    redirect(withSaved(`/coach/programs/${input.programId}#week-${input.week}`));
  } catch (e) { if (isRedirect(e)) throw e; return fail(e); }
}

/** Where saving a session may send you back to: our own pages only. */
const BACK = /^\/coach\/(sessions|setup|programs\/[\w-]+)(#[\w-]+)?$/;

/**
 * Save a session in the library (0017).
 *
 *   libraryId              change that session; every place it's used follows.
 *   place                  a new session, also put into that program week.
 *   relink                 a new session, taking over that one placement: "save
 *                          as new, just here", or a stand-alone session joining
 *                          the library.
 *   none of them           a new session, in the library only.
 */
export async function saveLibrarySession(input: {
  libraryId?: string; name: string; drillIds: string[];
  place?: { programId: string; week: number }; relink?: string; back: string;
}): Promise<Result> {
  try {
    const v = await staff();
    const name = input.name.trim().slice(0, 60);
    if (!name) return { ok: false, error: 'Give the session a name.' };
    if (!input.drillIds.length) return { ok: false, error: 'Add at least one drill.' };
    const drill_ids = input.drillIds.slice(0, 30);
    await ownDrills(v, drill_ids);

    if (input.libraryId && !input.relink) {
      const { error } = await v.db.from('library_sessions').update({ name, drill_ids })
        .eq('id', input.libraryId).eq('academy_id', v.academy.id);
      if (error) return { ok: false, error: plain(error) };
    } else {
      const { data, error } = await v.db.from('library_sessions')
        .insert({ academy_id: v.academy.id, name, drill_ids }).select('id').single();
      if (error) return { ok: false, error: plain(error) };
      if (input.relink) {
        const { error: e } = await v.db.from('academy_sessions').update({ library_id: data.id, name, drill_ids })
          .eq('id', input.relink).eq('academy_id', v.academy.id);
        if (e) return { ok: false, error: plain(e) };
      } else if (input.place) {
        const r = await place(v, { id: data.id, name, drill_ids }, input.place.programId, input.place.week);
        if (r) return { ok: false, error: r };
      }
    }
    done();
    redirect(withSaved(BACK.test(input.back) ? input.back : '/coach/sessions'));
  } catch (e) { if (isRedirect(e)) throw e; return fail(e); }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function place(v: any, s: { id: string; name: string; drill_ids: string[] }, programId: string, week: number): Promise<string | null> {
  await ownProgram(v, programId);
  const { count } = await v.db.from('academy_sessions').select('id', { count: 'exact', head: true })
    .eq('academy_id', v.academy.id).eq('program_id', programId).eq('week', week);
  const { error } = await v.db.from('academy_sessions').insert({
    academy_id: v.academy.id, program_id: programId, week, position: count ?? 0,
    name: s.name, drill_ids: s.drill_ids, library_id: s.id,
  });
  return error ? plain(error) : null;
}

/** Put a session from the library into a program week. */
export async function placeSession(libraryId: string, programId: string, week: number): Promise<Result> {
  try {
    const v = await staff();
    const { data } = await v.db.from('library_sessions').select('id, name, drill_ids')
      .eq('id', libraryId).eq('academy_id', v.academy.id).maybeSingle();
    if (!data) return { ok: false, error: 'That session isn’t in your library any more.' };
    const r = await place(v, data, programId, week);
    if (r) return { ok: false, error: r };
    done();
    redirect(withSaved(`/coach/programs/${programId}#week-${week}`));
  } catch (e) { if (isRedirect(e)) throw e; return fail(e); }
}

/** Delete a session from the library. Only one that no program uses. */
export async function deleteLibrarySession(id: string): Promise<Result> {
  try {
    const v = await staff();
    const { count, error: ce } = await v.db.from('academy_sessions').select('id', { count: 'exact', head: true })
      .eq('library_id', id).eq('academy_id', v.academy.id);
    // Unchecked is not "in no program": deleting would cut its placed copies loose.
    if (ce) return { ok: false, error: plain(ce) };
    if (count) return { ok: false, error: 'It’s still in a program. Take it out of the program first.' };
    const { error } = await v.db.from('library_sessions').delete().eq('id', id).eq('academy_id', v.academy.id);
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteSession(id: string): Promise<Result> {
  try {
    const v = await staff();
    const { error } = await v.db.from('academy_sessions').delete().eq('id', id).eq('academy_id', v.academy.id);
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/** Copy week n's sessions into week n+1, to change them from there. */
export async function copyWeek(programId: string, from: number, to: number): Promise<Result> {
  try {
    const v = await staff();
    // The same library sessions, used again (0017); before it, plain copies.
    const q = (cols: string) => v.db.from('academy_sessions').select(cols)
      .eq('program_id', programId).eq('academy_id', v.academy.id).eq('week', from);
    let { data } = await q('name, position, drill_ids, library_id');
    if (!data) ({ data } = await q('name, position, drill_ids'));
    if (!data?.length) return { ok: false, error: 'Nothing in that week to copy.' };
    const { error } = await v.db.from('academy_sessions').insert(
      (data as unknown as { name: string; position: number; drill_ids: string[]; library_id?: string | null }[])
        .map((s) => ({ ...s, academy_id: v.academy.id, program_id: programId, week: to })));
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

// ------------------------------------------------------------------ GROUPS ---
export async function saveGroup(_: unknown, f: FormData): Promise<Result> {
  try {
    const v = await staff();
    const id = str(f, 'id', 40);
    const day = str(f, 'meets_weekday', 2);
    const time = str(f, 'meets_time', 5);
    const row = {
      academy_id: v.academy.id,
      name: str(f, 'name', 40),
      meets_weekday: day === '' ? null : Number(day),
      meets_time: /^\d\d:\d\d$/.test(time) ? time : null,
      program_id: str(f, 'program_id', 40) || null,
      starts_on: /^\d{4}-\d\d-\d\d$/.test(str(f, 'starts_on', 10)) ? str(f, 'starts_on', 10) : null,
    };
    if (!row.name) return { ok: false, error: 'Give the group a name.' };
    if (row.program_id) await ownProgram(v, row.program_id);
    if (row.program_id && !row.starts_on) row.starts_on = localDate(new Date(), v.academy.timeZone);
    const q = id
      ? v.db.from('groups').update(row).eq('id', id).eq('academy_id', v.academy.id).select('id').single()
      : v.db.from('groups').insert(row).select('id').single();
    const { data, error } = await q;
    if (error) return { ok: false, error: plain(error) };
    done();
    redirect(withSaved(`/coach/groups/${data.id}`));
  } catch (e) { if (isRedirect(e)) throw e; return fail(e); }
}

export async function archiveGroup(id: string, archived: boolean): Promise<Result> {
  try {
    const v = await staff();
    const { error } = await v.db.from('groups').update({ archived }).eq('id', id).eq('academy_id', v.academy.id);
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/** Put a player in a group, or take them out. */
export async function setMembership(groupId: string, userId: string, member: boolean): Promise<Result> {
  try {
    const v = await staff();
    const { error } = member
      ? await v.db.from('group_members').upsert({ group_id: groupId, user_id: userId, academy_id: v.academy.id }, { onConflict: 'group_id,user_id', ignoreDuplicates: true })
      : await v.db.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId).eq('academy_id', v.academy.id);
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

// ------------------------------------------------------- ONE PLAYER'S WEEK ---
export async function assignProgram(userId: string, programId: string, startsOn?: string): Promise<Result> {
  try {
    const v = await staff();
    const start = startsOn && /^\d{4}-\d\d-\d\d$/.test(startsOn) ? startsOn : localDate(new Date(), v.academy.timeZone);
    await ownProgram(v, programId);
    const { error } = await v.db.from('player_programs')
      .upsert({ academy_id: v.academy.id, user_id: userId, program_id: programId, starts_on: start }, { onConflict: 'user_id,program_id' });
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

export async function unassignProgram(userId: string, programId: string): Promise<Result> {
  try {
    const v = await staff();
    const { error } = await v.db.from('player_programs').delete()
      .eq('user_id', userId).eq('program_id', programId).eq('academy_id', v.academy.id);
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/** "Just for you": a drill on this player's week, this week. */
export async function addAddon(userId: string, drillId: string, note: string): Promise<Result> {
  try {
    const v = await staff();
    const week_of = mondayOf(localDate(new Date(), v.academy.timeZone));
    await ownDrills(v, [drillId]);
    const { error } = await v.db.from('addons').insert({
      academy_id: v.academy.id, user_id: userId, drill_id: drillId,
      note: note.trim().slice(0, 200) || null, week_of, created_by: v.user.id,
    });
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

export async function removeAddon(id: string): Promise<Result> {
  try {
    const v = await staff();
    const { error } = await v.db.from('addons').delete().eq('id', id).eq('academy_id', v.academy.id);
    if (error) return { ok: false, error: plain(error) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

function isRedirect(e: unknown) {
  return typeof e === 'object' && e !== null && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT');
}

/**
 * Which sessions a drill is in, set from the drill's side: ticked sessions get
 * it at the end if they don't have it, unticked ones lose it. Sessions it was
 * already in keep it where it was.
 */
export async function setDrillSessions(drillId: string, sessionIds: string[], libraryIds?: string[]): Promise<Result> {
  try {
    const v = await staff();
    const want = new Set(sessionIds);
    // Every change is worked out and checked first, then written: a full or
    // emptied session found halfway used to leave the earlier ones saved.
    type Write = { table: 'library_sessions' | 'academy_sessions'; id: string; name: string; drill_ids: string[] };
    const writes: Write[] = [];
    // Library sessions, when the page offered them: each change follows into
    // every program week it's in (the 0017 trigger), so their placed copies
    // below are left alone.
    const libraryChosen = libraryIds !== undefined;
    const { data: lib, error: le } = await v.db.from('library_sessions').select('id, name, drill_ids').eq('academy_id', v.academy.id);
    if (le && libraryChosen) return { ok: false, error: plain(le) };
    const libById = new Map(((lib ?? []) as { id: string; name: string; drill_ids: string[] }[]).map((l) => [l.id, l]));
    if (libraryChosen) {
      const wantLib = new Set(libraryIds);
      for (const l of libById.values()) {
        const has = l.drill_ids.includes(drillId);
        if (has === wantLib.has(l.id)) continue;
        writes.push({ table: 'library_sessions', id: l.id, name: l.name,
          drill_ids: has ? l.drill_ids.filter((d) => d !== drillId) : [...l.drill_ids, drillId] });
      }
    }
    const q = (cols: string) => v.db.from('academy_sessions').select(cols).eq('academy_id', v.academy.id);
    let { data: sessions, error } = await q('id, name, drill_ids, library_id');
    if (error) ({ data: sessions, error } = await q('id, name, drill_ids'));
    if (error) return { ok: false, error: plain(error) };
    // A library session changes once, and everywhere it's used follows.
    const changed = new Set<string>();
    for (const s of (sessions ?? []) as unknown as { id: string; name: string; drill_ids: string[]; library_id?: string | null }[]) {
      if (libraryChosen && s.library_id) continue;
      const has = s.drill_ids.includes(drillId);
      if (has === want.has(s.id)) continue;
      if (s.library_id && changed.has(s.library_id)) continue;
      const drill_ids = has ? s.drill_ids.filter((d) => d !== drillId) : [...s.drill_ids, drillId];
      if (s.library_id) {
        changed.add(s.library_id);
        writes.push({ table: 'library_sessions', id: s.library_id, name: libById.get(s.library_id)?.name ?? s.name, drill_ids });
      } else writes.push({ table: 'academy_sessions', id: s.id, name: s.name, drill_ids });
    }
    const full = writes.find((w) => w.drill_ids.length > 30);
    if (full) return { ok: false, error: `${full.name} is full (30 drills). Nothing was changed.` };
    const emptied = writes.find((w) => !w.drill_ids.length);
    if (emptied) return { ok: false, error: `This is the only drill in ${emptied.name}, which needs at least one. Nothing was changed.` };
    for (const w of writes) {
      const { error: e } = await v.db.from(w.table).update({ drill_ids: w.drill_ids }).eq('id', w.id).eq('academy_id', v.academy.id);
      if (e) { done(); return { ok: false, error: plain(e) }; }
    }
    done();
    return { ok: true };
  } catch (e) { return fail(e); }
}
