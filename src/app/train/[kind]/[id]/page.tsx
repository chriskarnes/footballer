import { notFound } from 'next/navigation';
import { Runner } from '@/components/Runner';
import { getViewer } from '@/lib/viewer';
import type { DrillRow } from '@/lib/academy-week';
import type { Exercise } from '@/lib/types';
import { progressAmount } from '@/lib/week-builder';
import { getMyWeek, getTrainer } from '@/lib/player-week';

export const metadata = { title: 'Session', robots: { index: false } };

/** A trainer's drill, in the shape the runner draws. */
function asExercise(d: DrillRow, sessionId: string, i: number, step = 0): Exercise {
  const amount = progressAmount(d.amount, step);
  return {
    id: `${d.id}:${i}`, session_id: sessionId, program_id: '', name: d.name, exercise_order: i,
    sets: '', reps_time: amount ?? '', rest: '', total_seconds: d.minutes * 60, work_seconds: d.minutes * 60,
    total_minutes: d.minutes, touches: 0, touches_per_min: 0, primary_focus: (d.focus ?? 'ball_mastery') as Exercise['primary_focus'],
    focus_areas: [], equipment: [], intensity: 'moderate', space_required: 'minimal', can_do_at_home: true,
    gym_required: false, level: '', category: '', video_url: d.video_url, duration_confidence: 'high',
    amount: amount ?? `${d.minutes} min`,
    how: d.how ? d.how.split('\n').map((l) => l.trim()).filter(Boolean) : undefined,
  };
}

/**
 * Runs a session from the trainer's week: /train/session/<id> for a program
 * session, /train/custom/<id> for one from a week built for them, /train/addon/<id> for a "just for you" drill. RLS decides what
 * this player may read; finishing records it so their trainer sees it.
 *
 * Done already this week, it opens as done, from the same week Train reads,
 * so the two can't disagree. The drills are the trainer's, so a player sees
 * the trainer's name and face at the top, with their note on the session; a
 * trainer previewing sees neither.
 */
export default async function TrainerSessionPage({ params, searchParams }: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { kind, id } = await params;
  // "Do it again" from your history: back to the history, and run as new
  // rather than opening as this week's finished one.
  const history = (await searchParams).from === 'history';
  const v = await getViewer();
  if (!v.academy || !v.user || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const back = history ? { href: '/me', label: 'Your training' } : { href: '/', label: 'Train' };
  const player = v.role === 'player';
  const [week, trainer] = player ? await Promise.all([getMyWeek().catch(() => null), getTrainer()]) : [null, undefined];
  const item = week?.items.find((i) => i.kind === kind && i.ref === id);
  const completedDay = item?.done && !history ? item.doneOn ?? item.weekday : null;
  // What the trainer said about this session, said once at the top of it.
  const mine = { trainer, completedDay, note: item?.note ?? null };

  if (kind === 'session') {
    const { data: s } = await v.db.from('academy_sessions').select('id, name, drill_ids').eq('id', id).eq('academy_id', v.academy.id).maybeSingle();
    if (!s) notFound();
    const { data: rows } = await v.db.from('drills').select('id, name, amount, minutes, focus, video_url, how').in('id', s.drill_ids);
    const byId = new Map(((rows ?? []) as DrillRow[]).map((d) => [d.id, d]));
    const drills = (s.drill_ids as string[]).map((d, i) => byId.get(d) && asExercise(byId.get(d)!, s.id, i)).filter(Boolean) as Exercise[];
    return <Runner title={s.name} drills={drills} sessionRef={s.id} source="academy" back={back} {...mine} />;
  }

  // A session from a week built for this player: runs and records as an
  // academy session, so the trainer's ticks work the same.
  if (kind === 'custom') {
    type Built = { id: string; name: string; drill_ids: string[]; steps?: number[] };
    const q = async (cols: string) => (await v.db.from('player_week_sessions').select(cols).eq('id', id).eq('academy_id', v.academy!.id).maybeSingle()).data as Built | null;
    // With each drill's step (0012), so the amounts are this week's.
    const s = (await q('id, name, drill_ids, steps')) ?? (await q('id, name, drill_ids'));
    if (!s) notFound();
    const { data: rows } = await v.db.from('drills').select('id, name, amount, minutes, focus, video_url, how').in('id', s.drill_ids);
    const byId = new Map(((rows ?? []) as DrillRow[]).map((d) => [d.id, d]));
    const steps: number[] = s.steps ?? [];
    const drills = (s.drill_ids as string[]).map((d, i) => byId.get(d) && asExercise(byId.get(d)!, s.id, i, steps[i] ?? 0)).filter(Boolean) as Exercise[];
    return <Runner title={s.name} drills={drills} sessionRef={s.id} source="academy" back={back} {...mine} />;
  }

  // Any drill from the academy's library, when players may browse it.
  if (kind === 'drill') {
    const { data: d } = await v.db.from('drills').select('id, name, amount, minutes, focus, video_url, how').eq('id', id).eq('academy_id', v.academy.id).maybeSingle();
    if (!d) notFound();
    return <Runner title={d.name} drills={[asExercise(d as DrillRow, d.id, 0)]}
                   sessionRef={d.id} source="academy" back={history ? back : { href: '/library', label: 'Library' }} trainer={trainer} />;
  }

  if (kind === 'addon') {
    const { data: a } = await v.db.from('addons').select('id, note, drills(id, name, amount, minutes, focus, video_url, how)')
      .eq('id', id).eq('user_id', v.user.id).maybeSingle();
    const d = a?.drills as unknown as DrillRow | null;
    if (!a || !d) notFound();
    return <Runner title={d.name} drills={[asExercise(d, a.id, 0)]}
                   sessionRef={a.id} source="addon" back={back} {...mine} note={a.note} />;
  }
  notFound();
}
