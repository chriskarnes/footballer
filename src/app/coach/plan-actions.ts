'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { addDays, localDate, mondayOf, weekdayOf } from '@/lib/progress';
import { loadContent, loadDefaults, targetFor } from '@/lib/academy-data';
import { MAX_MINUTES, MIN_MINUTES, buildPlayerWeek, fitToTarget, type BuiltSession, type Feel, type PastWeek } from '@/lib/week-builder';
import { teamDays, type CustomRow } from '@/lib/academy-week';
import { allowed, DENIED, fingerprint, logCall } from '@/lib/ai';
import { proposeWeek } from '@/lib/ai-week';
import { loadPlayers } from '@/lib/coach-data';
import { FOCUS_LABELS } from '@/lib/types';
import { plain, notReady, Said } from '@/lib/plain-error';

/**
 * A player's targets and focus, and the weeks built from them (0010). A
 * built week is published as soon as it's built: it is the trainer's own
 * action, and every session in it can still be changed or taken back.
 */
async function staff() {
  const v = await getViewer();
  if (!v.academy || !v.user || !v.staff) throw new Said('Only trainers can do that.');
  return v as typeof v & { academy: NonNullable<typeof v.academy>; user: NonNullable<typeof v.user> };
}

/** The player is one of this academy's: plans and weeks are written for an id
 *  from the page, and the database only checks the caller is staff. */
async function ownPlayer(v: Awaited<ReturnType<typeof staff>>, userId: string) {
  const { data, error } = await v.db.from('academy_members').select('user_id')
    .eq('academy_id', v.academy.id).eq('user_id', userId).eq('role', 'player').maybeSingle();
  if (error) throw error;
  if (!data) throw new Said('They aren’t one of your players any more. Reload and try again.');
}

type Result = { ok: true; by?: 'ai' | 'rules'; why?: string } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: plain(e) });
const done = () => revalidatePath('/', 'layout');
const missing = (m: string) => /player_plans|player_week_sessions|academy_plan_defaults|schema cache/.test(m)
  ? notReady(m, '0010') : plain(m);

const clamp = (n: unknown, lo: number, hi: number) => {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : null;
};

/** Sessions a week, minutes each, and up to three things to work on. Null numbers mean the academy default. */
export async function savePlan(userId: string, plan: { sessions: number | null; minutes: number | null; focus: string[]; progress?: boolean | null }): Promise<Result> {
  try {
    const v = await staff();
    await ownPlayer(v, userId);
    const focus = [...new Set(plan.focus)].filter((t) => t in FOCUS_LABELS).slice(0, 3);
    const row: Record<string, unknown> = {
      academy_id: v.academy.id, user_id: userId, focus,
      sessions: plan.sessions === null ? null : clamp(plan.sessions, 1, 7),
      minutes: plan.minutes === null ? null : clamp(plan.minutes, MIN_MINUTES, MAX_MINUTES),
      updated_at: new Date().toISOString(),
    };
    // Null follows the academy; left out, it stays as it was.
    if (plan.progress !== undefined) row.progress = plan.progress;
    const { error } = await v.db.from('player_plans').upsert(row);
    if (error && /progress/.test(error.message)) return { ok: false, error: notReady(error, '0013') };
    if (error) return { ok: false, error: missing(error.message) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/**
 * How their week is set. Back to their program takes away the custom weeks
 * from this week on; custom builds nothing until the trainer builds a week.
 */
export async function setMode(userId: string, mode: 'program' | 'custom'): Promise<Result> {
  try {
    const v = await staff();
    await ownPlayer(v, userId);
    const { error } = await v.db.from('player_plans').upsert({
      academy_id: v.academy.id, user_id: userId, mode, autopilot: false, updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: /mode/.test(error.message) ? notReady(error, '0014') : missing(error.message) };
    if (mode === 'program') {
      const from = mondayOf(localDate(new Date(), v.academy.timeZone));
      // All of them, done ones too: any built session left in a week takes
      // the program's place that week (buildWeek). What they did stays in
      // their history either way.
      const del = await v.db.from('player_week_sessions').delete().eq('academy_id', v.academy.id).eq('user_id', userId).gte('week_of', from).neq('made_by', 'player');
      if (del.error) return { ok: false, error: missing(del.error.message) };
    }
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/**
 * What players may do on their own: browse the library, add up to `extras`
 * sessions a week, and have Speed & Stamina.
 */
export async function savePlayerOptions(library: boolean, extras: number, speed: boolean): Promise<Result> {
  try {
    const v = await staff();
    const d = await loadDefaults(v.db, v.academy.id);
    const row = {
      academy_id: v.academy.id, sessions: d.sessions, minutes: d.minutes,
      player_library: !!library, player_extras: clamp(extras, 0, 3) ?? 0, updated_at: new Date().toISOString(),
    };
    let { error } = await v.db.from('academy_plan_defaults').upsert({ ...row, player_speed: !!speed });
    // Before 0019 there's no Speed setting, and Speed is on: fine, unless
    // they're turning it off.
    if (error && /player_speed/.test(error.message)) {
      if (!speed) return { ok: false, error: notReady(error, '0019') };
      ({ error } = await v.db.from('academy_plan_defaults').upsert(row));
    }
    if (error && /player_/.test(error.message)) return { ok: false, error: notReady(error, '0015') };
    if (error) return { ok: false, error: missing(error.message) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/** The academy's default target, for every player without their own. */
export async function saveDefaults(sessions: number, minutes: number, progress: boolean): Promise<Result> {
  try {
    const v = await staff();
    const { error } = await v.db.from('academy_plan_defaults').upsert({
      academy_id: v.academy.id, sessions: clamp(sessions, 1, 7), minutes: clamp(minutes, MIN_MINUTES, MAX_MINUTES), progress: !!progress,
      updated_at: new Date().toISOString(),
    });
    if (error && /progress/.test(error.message)) return { ok: false, error: notReady(error, '0013') };
    if (error) return { ok: false, error: missing(error.message) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/**
 * Builds this week or next for one player and publishes it, replacing any
 * week already built for them then. Their program steps aside for that week.
 *
 * The rules build it first, always. Then, if the AI is set up and within its
 * limits, it proposes its own picks, which are checked and fitted to the
 * target (fitToTarget) before they replace the rules' sessions. Days are the
 * rules' either way. `why` says when the AI was skipped.
 */
export async function buildWeekFor(userId: string, which: 'this' | 'next'): Promise<Result> {
  try {
    const v = await staff();
    await ownPlayer(v, userId);
    const today = localDate(new Date(), v.academy.timeZone);
    // Five weeks back: enough to see a block of three before either week.
    const c = await loadContent(v.db, v.academy.id, { addonsSince: addDays(today, -35) });
    if (!c.drills.length) return { ok: false, error: 'Add some drills first. Weeks are built from your own drills.' };
    const thisMonday = mondayOf(today);
    const week_of = which === 'next' ? addDays(thisMonday, 7) : thisMonday;
    const t = targetFor(c, userId);
    const sched = c.schedules.find((s) => s.user_id === userId);
    const meets = c.groups.filter((g) => !g.archived && g.meets_weekday !== null
      && c.memberships.some((m) => m.group_id === g.id && m.user_id === userId)).map((g) => g.meets_weekday as number);
    // This week, built mid-week: only the days left, and no more sessions
    // than there are days for. On days already gone they'd only read as missed.
    const from = which === 'this' ? weekdayOf(today) : 0;
    const busy = { ...teamDays(sched), meets, from };
    const fit = Math.min(t.sessions, 7 - from);
    const past = await pastWeeks(v.db, v.academy.id, c.custom, userId, week_of);
    const recent = past.slice(0, 2).flatMap((w) => w.sessions.flatMap((x) => x.drill_ids));
    // Step-ups off: no history, so every drill starts at its own amount and
    // nothing carries over; recent drills still give way to fresh ones.
    const history = t.progress ? past : [];

    const rules = buildPlayerWeek({ drills: c.drills, target: { ...t, sessions: fit }, focus: t.focus, recent, busy, seed: `${userId}:${week_of}`, weekOf: week_of, history });
    if (!rules.length) return { ok: false, error: 'Nothing to build from yet.' };
    let rows: (BuiltSession & { note: string | null; made_by: 'ai' | 'rules' })[] = rules.map((s) => ({ ...s, note: null, made_by: 'rules' }));
    let why: string | undefined;

    const gate = await allowed(v.db, { academyId: v.academy.id, timeZone: v.academy.timeZone, playerId: userId, kind: 'week' });
    if (gate.ok) {
      const { players } = await loadPlayers(v.db, v.academy, { player: userId, days: 21, content: c });
      const p = players[0];
      const last = p?.progress.weeks[p.progress.weeks.length - 2];
      // What was set the week before, and how much of it was done: from the
      // week built then, when there was one (past weeks' plans aren't kept).
      const before = past[0]?.week_of === addDays(week_of, -7) ? past[0] : null;
      const res = await proposeWeek({
        first: p?.first ?? 'Player', age: p?.age_band ?? null, positions: p?.positions ?? null,
        target: { ...t, sessions: fit }, focus: t.focus, drills: c.drills, recent, week: rules,
        lately: { done: before ? before.sessions.filter((x) => x.done).length : last?.done ?? 0, planned: before ? before.sessions.length : last?.planned ?? 0, titles: (p?.done ?? []).flatMap((d) => d.title ? [d.title] : []) },
      });
      await logCall(v.db, {
        academyId: v.academy.id, actorId: v.user.id, playerId: userId, kind: 'week', ok: !!res.sessions, usage: res.usage,
        inputHash: fingerprint({ week_of, t, busy, history, drills: c.drills.map((d) => d.id).sort() }),
      });
      if (res.sessions) {
        rows = fitToTarget(res.sessions, rules, c.drills, t.minutes, t.focus)
          .map((s) => ({ ...s, note: s.note ?? null, made_by: s.fromAi ? 'ai' : 'rules' }));
      } else why = 'AI didn’t answer, so this is the rules’ week';
    } else why = `${DENIED[gate.why]}, so this is built from their settings`;

    // The new week goes in before the old one comes out, so a failed write
    // leaves the player the week they had, not none. Their own extras stay.
    const old = await v.db.from('player_week_sessions').select('id, weekday, position').eq('academy_id', v.academy.id).eq('user_id', userId).eq('week_of', week_of).neq('made_by', 'player');
    if (old.error) return { ok: false, error: missing(old.error.message) };
    const before = (old.data ?? []) as { id: string; weekday: number | null; position: number }[];
    // Sessions already done stay as they are; the new week fills the rest:
    // fewer sessions, and off the days already done where it can.
    const finished = await doneOf(v.db, v.academy.id, userId, week_of, before.map((x) => x.id));
    const kept = before.filter((x) => finished.has(x.id));
    const oldIds = before.filter((x) => !finished.has(x.id)).map((x) => x.id);
    if (kept.length) {
      const room = rows.length - kept.length;
      if (room <= 0) return { ok: false, error: 'They’ve done every session that week already, so there’s nothing to rebuild.' };
      const doneDays = new Set(kept.map((x) => x.weekday));
      const order = [...rows.keys()].sort((a, b) => Number(doneDays.has(rows[a].weekday)) - Number(doneDays.has(rows[b].weekday)) || a - b);
      const pick = new Set(order.slice(0, room));
      rows = rows.filter((_, i) => pick.has(i));
    }
    const offset = kept.length ? Math.max(...kept.map((x) => x.position)) + 1 : 0;
    // Newest columns first; before 0012 (steps, light) or 0011 (note), without them.
    const tiers: string[][] = [['note', 'steps', 'light', 'changes'], ['note'], []];
    let error: { message: string } | null = null;
    for (const extra of tiers) {
      ({ error } = await v.db.from('player_week_sessions').insert(rows.map((s, i) => {
        const all: Record<string, unknown> = { note: s.note, steps: s.steps, light: s.light, changes: s.changes };
        return {
          academy_id: v.academy.id, user_id: userId, week_of, position: offset + i,
          name: s.name, drill_ids: s.drill_ids, weekday: s.weekday, made_by: s.made_by,
          ...Object.fromEntries(extra.map((k) => [k, all[k]])),
        };
      })));
      if (!error || !/note|steps|light|changes/.test(error.message)) break;
    }
    if (error) return { ok: false, error: missing(error.message) };
    if (oldIds.length) {
      const del = await v.db.from('player_week_sessions').delete().eq('academy_id', v.academy.id).in('id', oldIds);
      if (del.error) { done(); return { ok: false, error: plain(del.error, 'The new week is in, but the old one couldn’t be cleared. Try Rebuild.') }; }
    }
    // Building a week means custom weeks, if they weren't already (before 0014, no mode).
    if (t.mode !== 'auto') {
      const m = await v.db.from('player_plans').upsert({ academy_id: v.academy.id, user_id: userId, mode: 'custom' });
      // Without the switch the built week sits under the program's, unseen.
      if (m.error && !/mode/.test(m.error.message)) { done(); return { ok: false, error: plain(m.error, 'The week is built, but couldn’t be switched on. Try Rebuild.') }; }
    }
    done();
    // Too few drills to fill the time: say so, rather than quietly building short sessions.
    const full = rows.filter((r) => !r.light);
    const shortest = full.length ? Math.min(...full.map((r) => r.minutes)) : t.minutes;
    if (shortest < t.minutes - 5) {
      const short = `Sessions come to about ${shortest} of ${t.minutes} min: add more drills${t.focus.length ? ` for ${t.focus.map((f) => FOCUS_LABELS[f as keyof typeof FOCUS_LABELS] ?? f).join(', ')}` : ''} to fill them`;
      why = why ? `${short}. ${why}` : short;
    }
    if (fit < t.sessions) {
      const left = `${fit} ${fit === 1 ? 'session' : 'sessions'} for the ${fit === 1 ? 'day' : 'days'} left this week`;
      why = why ? `${left}. ${why}` : left;
    }
    return { ok: true, by: rows.some((r) => r.made_by === 'ai') ? 'ai' : 'rules', why };
  } catch (e) { return fail(e); }
}

/**
 * The player's built weeks before `weekOf`, newest first, each session with
 * whether it was done, how it felt and which drills were ticked.
 */
/**
 * Which of these built sessions the player has already done. Rebuilding or
 * going back to the program leaves those: a finished session stays finished,
 * with its feel and ticks, and still counts for the next week's levels.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function doneOf(db: any, academyId: string, userId: string, since: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await db.rpc('academy_completions', { p_academy: academyId, p_since: `${since}T00:00:00Z` });
  if (error) throw error;
  return new Set(((data ?? []) as { user_id: string; source_ref: string | null }[])
    .filter((r) => r.user_id === userId && r.source_ref && ids.includes(r.source_ref)).map((r) => r.source_ref as string));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pastWeeks(db: any, academyId: string, custom: CustomRow[], userId: string, weekOf: string): Promise<PastWeek[]> {
  // The trainer's weeks only: a player's own extras don't set levels or blocks.
  const mine = custom.filter((x) => x.user_id === userId && x.week_of < weekOf && x.made_by !== 'player');
  if (!mine.length) return [];
  const since = `${mine.map((x) => x.week_of).sort()[0]}T00:00:00Z`;
  const { data } = await db.rpc('academy_completions', { p_academy: academyId, p_since: since });
  const runs = ((data ?? []) as { user_id: string; source: string; source_ref: string | null; feel?: Feel | null; done_ids?: string[] | null }[])
    .filter((r) => r.user_id === userId && r.source === 'academy' && r.source_ref);
  const weeks = new Map<string, PastWeek>();
  for (const x of [...mine].sort((a, b) => a.position - b.position)) {
    const w = weeks.get(x.week_of) ?? { week_of: x.week_of, light: false, sessions: [] };
    const run = runs.filter((r) => r.source_ref === x.id).pop();
    w.light ||= !!x.light;
    w.sessions.push({ drill_ids: x.drill_ids, steps: x.steps ?? [], done: !!run, feel: run?.feel ?? null, ticked: run?.done_ids ?? null });
    weeks.set(x.week_of, w);
  }
  return [...weeks.values()].sort((a, b) => b.week_of.localeCompare(a.week_of));
}

/** One session of a built week: its drills, its day. Marked as changed by hand. */
export async function saveBuiltSession(id: string, change: { drill_ids?: string[]; steps?: number[]; changes?: string[]; weekday?: number }): Promise<Result> {
  try {
    const v = await staff();
    const row: Record<string, unknown> = { made_by: 'trainer' };
    if (change.drill_ids) {
      if (!change.drill_ids.length) return { ok: false, error: 'A session needs at least one drill.' };
      // Written into the player's week as ids: they have to be this academy's.
      const unique = [...new Set(change.drill_ids)];
      const { data: mine, error: de } = await v.db.from('drills').select('id').eq('academy_id', v.academy.id).in('id', unique);
      if (de) return { ok: false, error: plain(de) };
      if ((mine ?? []).length !== unique.length) return { ok: false, error: 'One of those drills isn’t in your academy any more. Reload and try again.' };
      row.drill_ids = change.drill_ids.slice(0, 20);
      if (change.steps) row.steps = change.steps.slice(0, 20).map((n) => clamp(n, 0, 9) ?? 0);
      if (change.changes) row.changes = change.changes.slice(0, 20).map((c) => ['new', 'same', 'up', 'harder', 'hold'].includes(c) ? c : 'new');
    }
    if (change.weekday !== undefined) row.weekday = clamp(change.weekday, 0, 6);
    let { data: hit, error } = await v.db.from('player_week_sessions').update(row).eq('id', id).eq('academy_id', v.academy.id).select('id');
    // Before 0012: just the drills and the day.
    if (error && /steps|changes/.test(error.message)) {
      delete row.steps; delete row.changes;
      ({ data: hit, error } = await v.db.from('player_week_sessions').update(row).eq('id', id).eq('academy_id', v.academy.id).select('id'));
    }
    if (error) return { ok: false, error: missing(error.message) };
    // Nothing matched: the week was rebuilt or taken away since this page loaded.
    if (!hit?.length) return { ok: false, error: 'That session isn’t in their week any more. Reload and try again.' };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}
