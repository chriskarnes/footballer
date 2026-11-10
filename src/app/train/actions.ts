'use server';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/viewer';
import { getMyWeek } from '@/lib/player-week';
import { loadContent, targetFor } from '@/lib/academy-data';
import { addDays, localDate, mondayOf, weekdayOf } from '@/lib/progress';
import { buildPlayerWeek } from '@/lib/week-builder';

const isRedirect = (e: unknown) => typeof e === 'object' && e !== null && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT');

/**
 * One more session, when the player has time and their trainer allows it.
 * Rules only, no AI: their focus and session length, drills they haven't done
 * this week, each at the level they last had it. Then straight into it.
 */
export async function addMySession(): Promise<{ ok: false; error: string }> {
  try {
    const v = await getViewer();
    if (!v.academy || !v.user || v.role !== 'player') return { ok: false, error: 'Only players can add a session.' };
    const week = await getMyWeek();
    if (!week?.more) return { ok: false, error: 'Your trainer hasn’t turned this on.' };
    if (week.more.why) return { ok: false, error: week.more.why };

    const today = localDate(new Date(), v.academy.timeZone);
    const monday = mondayOf(today);
    const c = await loadContent(v.db, v.academy.id, { addonsSince: addDays(monday, -14) });
    const t = targetFor(c, v.user.id);
    const mine = c.custom.filter((x) => x.user_id === v.user!.id);
    // This week's drills (set and extra), then last week's: fresh ones first.
    const sessionDrills = new Map(c.sessions.map((s) => [s.id, s.drill_ids]));
    const thisWeek = [
      ...week.items.flatMap((i) => i.kind === 'session' ? sessionDrills.get(i.ref) ?? [] : []),
      ...mine.filter((x) => x.week_of === monday).flatMap((x) => x.drill_ids),
    ];
    const recent = [...thisWeek, ...mine.filter((x) => x.week_of < monday).flatMap((x) => x.drill_ids)];
    // The level each drill was last at, when their weeks level up.
    const level = new Map<string, number>();
    if (t.progress) for (const x of [...mine].sort((a, b) => a.week_of.localeCompare(b.week_of)))
      x.drill_ids.forEach((id, k) => level.set(id, x.steps?.[k] ?? 0));
    // Their focus, taking turns with the extras already added.
    const n = week.items.filter((i) => i.extra).length;
    const focus = t.focus.length ? [...t.focus.slice(n % t.focus.length), ...t.focus.slice(0, n % t.focus.length)] : [];

    const [s] = buildPlayerWeek({
      drills: c.drills, target: { sessions: 1, minutes: t.minutes }, focus, recent, busy: {},
      seed: `${v.user.id}:${today}:${n}`, weekOf: monday, history: [],
    });
    if (!s) return { ok: false, error: 'Nothing to build from yet.' };
    const { data: id, error } = await v.db.rpc('add_extra_session', {
      p_academy: v.academy.id, p_week_of: monday, p_name: s.name, p_drill_ids: s.drill_ids,
      p_steps: s.drill_ids.map((d) => level.get(d) ?? 0), p_weekday: weekdayOf(today),
    });
    if (error) return { ok: false, error: /limit/.test(error.message) ? 'That’s all your extras this week.' : /function|schema/.test(error.message) ? 'Your trainer’s app needs an update (migration 0015).' : error.message };
    redirect(`/train/custom/${id}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
