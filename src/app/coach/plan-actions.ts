'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { addDays, localDate, mondayOf } from '@/lib/progress';
import { loadContent, targetFor } from '@/lib/academy-data';
import { buildPlayerWeek, fitToTarget, type BuiltSession, type Feel, type PastWeek } from '@/lib/week-builder';
import type { CustomRow } from '@/lib/academy-week';
import { allowed, DENIED, fingerprint, logCall } from '@/lib/ai';
import { proposeWeek } from '@/lib/ai-week';
import { loadPlayers } from '@/lib/coach-data';
import { FOCUS_LABELS } from '@/lib/types';

/**
 * A player's targets and focus, and the weeks built from them (0010). A
 * built week is published as soon as it's built: it is the trainer's own
 * action, and every session in it can still be changed or taken back.
 */
async function staff() {
  const v = await getViewer();
  if (!v.academy || !v.user || !v.staff) throw new Error('Only trainers can do that.');
  return v as typeof v & { academy: NonNullable<typeof v.academy>; user: NonNullable<typeof v.user> };
}

type Result = { ok: true; by?: 'ai' | 'rules'; why?: string } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const done = () => revalidatePath('/', 'layout');
const missing = (m: string) => /player_plans|player_week_sessions|academy_plan_defaults|schema cache/.test(m)
  ? 'Run migration 0010 in Supabase first.' : m;

const clamp = (n: unknown, lo: number, hi: number) => {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : null;
};

/** Sessions a week, minutes each, and up to three things to work on. Null numbers mean the academy default. */
export async function savePlan(userId: string, plan: { sessions: number | null; minutes: number | null; focus: string[]; progress?: boolean | null }): Promise<Result> {
  try {
    const v = await staff();
    const focus = [...new Set(plan.focus)].filter((t) => t in FOCUS_LABELS).slice(0, 3);
    const row: Record<string, unknown> = {
      academy_id: v.academy.id, user_id: userId, focus,
      sessions: plan.sessions === null ? null : clamp(plan.sessions, 1, 7),
      minutes: plan.minutes === null ? null : clamp(plan.minutes, 5, 90),
      updated_at: new Date().toISOString(),
    };
    // Null follows the academy; left out, it stays as it was.
    if (plan.progress !== undefined) row.progress = plan.progress;
    const { error } = await v.db.from('player_plans').upsert(row);
    if (error && /progress/.test(error.message)) return { ok: false, error: 'Run migration 0013 in Supabase first.' };
    if (error) return { ok: false, error: missing(error.message) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/** The academy's default target, for every player without their own. */
export async function saveDefaults(sessions: number, minutes: number, progress: boolean): Promise<Result> {
  try {
    const v = await staff();
    const { error } = await v.db.from('academy_plan_defaults').upsert({
      academy_id: v.academy.id, sessions: clamp(sessions, 1, 7), minutes: clamp(minutes, 5, 90), progress: !!progress,
      updated_at: new Date().toISOString(),
    });
    if (error && /progress/.test(error.message)) return { ok: false, error: 'Run migration 0013 in Supabase first.' };
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
    const busy = { club: sched?.club_days ?? [], game: sched?.game_day ?? null, meets };
    const past = await pastWeeks(v.db, v.academy.id, c.custom, userId, week_of);
    const recent = past.slice(0, 2).flatMap((w) => w.sessions.flatMap((x) => x.drill_ids));
    // Step-ups off: no history, so every drill starts at its own amount and
    // nothing carries over; recent drills still give way to fresh ones.
    const history = t.progress ? past : [];

    const rules = buildPlayerWeek({ drills: c.drills, target: t, focus: t.focus, recent, busy, seed: `${userId}:${week_of}`, weekOf: week_of, history });
    if (!rules.length) return { ok: false, error: 'Nothing to build from yet.' };
    let rows: (BuiltSession & { note: string | null; made_by: 'ai' | 'rules' })[] = rules.map((s) => ({ ...s, note: null, made_by: 'rules' }));
    let why: string | undefined;

    const gate = await allowed(v.db, { academyId: v.academy.id, timeZone: v.academy.timeZone, playerId: userId, kind: 'week' });
    if (gate.ok) {
      const { players } = await loadPlayers(v.db, v.academy, { player: userId, days: 21, content: c });
      const p = players[0];
      const last = p?.progress.weeks[p.progress.weeks.length - 2];
      const res = await proposeWeek({
        first: p?.first ?? 'Player', age: p?.age_band ?? null, positions: p?.positions ?? null,
        target: t, focus: t.focus, drills: c.drills, recent, week: rules,
        lately: { done: last?.done ?? 0, planned: last?.planned ?? 0, titles: (p?.done ?? []).flatMap((d) => d.title ? [d.title] : []) },
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

    const del = await v.db.from('player_week_sessions').delete().eq('academy_id', v.academy.id).eq('user_id', userId).eq('week_of', week_of);
    if (del.error) return { ok: false, error: missing(del.error.message) };
    // Newest columns first; before 0012 (steps, light) or 0011 (note), without them.
    const tiers: string[][] = [['note', 'steps', 'light', 'changes'], ['note'], []];
    let error: { message: string } | null = null;
    for (const extra of tiers) {
      ({ error } = await v.db.from('player_week_sessions').insert(rows.map((s, i) => {
        const all: Record<string, unknown> = { note: s.note, steps: s.steps, light: s.light, changes: s.changes };
        return {
          academy_id: v.academy.id, user_id: userId, week_of, position: i,
          name: s.name, drill_ids: s.drill_ids, weekday: s.weekday, made_by: s.made_by,
          ...Object.fromEntries(extra.map((k) => [k, all[k]])),
        };
      })));
      if (!error || !/note|steps|light|changes/.test(error.message)) break;
    }
    if (error) return { ok: false, error: missing(error.message) };
    done();
    return { ok: true, by: rows.some((r) => r.made_by === 'ai') ? 'ai' : 'rules', why };
  } catch (e) { return fail(e); }
}

/**
 * The player's built weeks before `weekOf`, newest first, each session with
 * whether it was done, how it felt and which drills were ticked.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pastWeeks(db: any, academyId: string, custom: CustomRow[], userId: string, weekOf: string): Promise<PastWeek[]> {
  const mine = custom.filter((x) => x.user_id === userId && x.week_of < weekOf);
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
      row.drill_ids = change.drill_ids.slice(0, 20);
      if (change.steps) row.steps = change.steps.slice(0, 20).map((n) => clamp(n, 0, 9) ?? 0);
      if (change.changes) row.changes = change.changes.slice(0, 20).map((c) => ['new', 'same', 'up', 'harder', 'hold'].includes(c) ? c : 'new');
    }
    if (change.weekday !== undefined) row.weekday = clamp(change.weekday, 0, 6);
    let { error } = await v.db.from('player_week_sessions').update(row).eq('id', id).eq('academy_id', v.academy.id);
    // Before 0012: just the drills and the day.
    if (error && /steps|changes/.test(error.message)) {
      delete row.steps; delete row.changes;
      ({ error } = await v.db.from('player_week_sessions').update(row).eq('id', id).eq('academy_id', v.academy.id));
    }
    if (error) return { ok: false, error: missing(error.message) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/** Takes a built week back: the player's program is their week again. */
export async function clearBuiltWeek(userId: string, weekOf: string): Promise<Result> {
  try {
    const v = await staff();
    const { error } = await v.db.from('player_week_sessions').delete()
      .eq('academy_id', v.academy.id).eq('user_id', userId).eq('week_of', weekOf);
    if (error) return { ok: false, error: missing(error.message) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}
