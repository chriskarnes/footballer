'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { addDays, localDate, mondayOf } from '@/lib/progress';
import { loadContent, targetFor } from '@/lib/academy-data';
import { buildPlayerWeek } from '@/lib/week-builder';
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

type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const done = () => revalidatePath('/', 'layout');
const missing = (m: string) => /player_plans|player_week_sessions|academy_plan_defaults|schema cache/.test(m)
  ? 'Run migration 0010 in Supabase first.' : m;

const clamp = (n: unknown, lo: number, hi: number) => {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : null;
};

/** Sessions a week, minutes each, and up to three things to work on. Null numbers mean the academy default. */
export async function savePlan(userId: string, plan: { sessions: number | null; minutes: number | null; focus: string[] }): Promise<Result> {
  try {
    const v = await staff();
    const focus = [...new Set(plan.focus)].filter((t) => t in FOCUS_LABELS).slice(0, 3);
    const { error } = await v.db.from('player_plans').upsert({
      academy_id: v.academy.id, user_id: userId, focus,
      sessions: plan.sessions === null ? null : clamp(plan.sessions, 1, 7),
      minutes: plan.minutes === null ? null : clamp(plan.minutes, 5, 90),
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: missing(error.message) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/** The academy's default target, for every player without their own. */
export async function saveDefaults(sessions: number, minutes: number): Promise<Result> {
  try {
    const v = await staff();
    const { error } = await v.db.from('academy_plan_defaults').upsert({
      academy_id: v.academy.id, sessions: clamp(sessions, 1, 7), minutes: clamp(minutes, 5, 90), updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: missing(error.message) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/**
 * Builds this week or next for one player and publishes it, replacing any
 * week already built for them then. Their program steps aside for that week.
 */
export async function buildWeekFor(userId: string, which: 'this' | 'next'): Promise<Result> {
  try {
    const v = await staff();
    const c = await loadContent(v.db, v.academy.id, { addonsSince: addDays(localDate(new Date(), v.academy.timeZone), -21) });
    if (!c.drills.length) return { ok: false, error: 'Add some drills first. Weeks are built from your own drills.' };
    const thisMonday = mondayOf(localDate(new Date(), v.academy.timeZone));
    const week_of = which === 'next' ? addDays(thisMonday, 7) : thisMonday;
    const t = targetFor(c, userId);
    const sched = c.schedules.find((s) => s.user_id === userId);
    const meets = c.groups.filter((g) => !g.archived && g.meets_weekday !== null
      && c.memberships.some((m) => m.group_id === g.id && m.user_id === userId)).map((g) => g.meets_weekday as number);
    // What they had in the last two built weeks drops down the list.
    const recent = c.custom.filter((x) => x.user_id === userId && x.week_of < week_of && x.week_of >= addDays(week_of, -14))
      .sort((a, b) => b.week_of.localeCompare(a.week_of)).flatMap((x) => x.drill_ids);

    const built = buildPlayerWeek({
      drills: c.drills, target: t, focus: t.focus, recent,
      busy: { club: sched?.club_days ?? [], game: sched?.game_day ?? null, meets },
      seed: `${userId}:${week_of}`,
    });
    if (!built.length) return { ok: false, error: 'Nothing to build from yet.' };

    const del = await v.db.from('player_week_sessions').delete().eq('academy_id', v.academy.id).eq('user_id', userId).eq('week_of', week_of);
    if (del.error) return { ok: false, error: missing(del.error.message) };
    const { error } = await v.db.from('player_week_sessions').insert(built.map((s, i) => ({
      academy_id: v.academy.id, user_id: userId, week_of, position: i,
      name: s.name, drill_ids: s.drill_ids, weekday: s.weekday, made_by: 'rules',
    })));
    if (error) return { ok: false, error: missing(error.message) };
    done(); return { ok: true };
  } catch (e) { return fail(e); }
}

/** One session of a built week: its drills, its day. Marked as changed by hand. */
export async function saveBuiltSession(id: string, change: { drill_ids?: string[]; weekday?: number }): Promise<Result> {
  try {
    const v = await staff();
    const row: Record<string, unknown> = { made_by: 'trainer' };
    if (change.drill_ids) {
      if (!change.drill_ids.length) return { ok: false, error: 'A session needs at least one drill.' };
      row.drill_ids = change.drill_ids.slice(0, 20);
    }
    if (change.weekday !== undefined) row.weekday = clamp(change.weekday, 0, 6);
    const { error } = await v.db.from('player_week_sessions').update(row).eq('id', id).eq('academy_id', v.academy.id);
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
