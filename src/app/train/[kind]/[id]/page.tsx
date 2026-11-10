import { notFound } from 'next/navigation';
import { Runner } from '@/components/Runner';
import { getViewer } from '@/lib/viewer';
import type { DrillRow } from '@/lib/academy-week';
import type { Exercise } from '@/lib/types';
import { progressAmount } from '@/lib/week-builder';

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
 */
export default async function TrainerSessionPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const v = await getViewer();
  if (!v.academy || !v.user || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const back = { href: '/', label: 'Train' };

  if (kind === 'session') {
    const { data: s } = await v.db.from('academy_sessions').select('id, name, drill_ids').eq('id', id).eq('academy_id', v.academy.id).maybeSingle();
    if (!s) notFound();
    const { data: rows } = await v.db.from('drills').select('id, name, amount, minutes, focus, video_url, how').in('id', s.drill_ids);
    const byId = new Map(((rows ?? []) as DrillRow[]).map((d) => [d.id, d]));
    const drills = (s.drill_ids as string[]).map((d, i) => byId.get(d) && asExercise(byId.get(d)!, s.id, i)).filter(Boolean) as Exercise[];
    return <Runner title={s.name} subtitle={`${drills.length} drills`} drills={drills} sessionRef={s.id} source="academy" back={back} />;
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
    return <Runner title={s.name} subtitle={`${drills.length} drills`} drills={drills} sessionRef={s.id} source="academy" back={back} />;
  }

  if (kind === 'addon') {
    const { data: a } = await v.db.from('addons').select('id, note, drills(id, name, amount, minutes, focus, video_url, how)')
      .eq('id', id).eq('user_id', v.user.id).maybeSingle();
    const d = a?.drills as unknown as DrillRow | null;
    if (!a || !d) notFound();
    return <Runner title={d.name} subtitle={a.note ?? 'Just for you'} drills={[asExercise(d, a.id, 0)]}
                   sessionRef={a.id} source="addon" back={back} />;
  }
  notFound();
}
