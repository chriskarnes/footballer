import { notFound } from 'next/navigation';
import { getExercises, getSessions } from '@/lib/library';
import { Runner } from '@/components/Runner';
import { serverClient } from '@/lib/supabase/server';
import type { Exercise } from '@/lib/types';

/**
 * One route serves both a library session and a saved workout ("do it again"),
 * because to the player they're the same thing: a list of drills to tick off.
 */
export default async function SessionPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const exercises = await getExercises();

  if (from === 'history') {
    try {
      const db = await serverClient();
      const { data: w } = await db.from('workouts').select('*').eq('id', id).single();
      if (w) {
        const byId = new Map(exercises.map((e) => [e.id, e]));
        const drills = (w.exercise_ids as string[]).map((id) => byId.get(id)).filter(Boolean) as Exercise[];
        return <Runner title={w.title} subtitle="Repeat of a saved session"
                       drills={drills} workoutId={w.id} />;
      }
    } catch { /* fall through to library lookup */ }
  }

  const sessions = await getSessions();
  const s = sessions.find((x) => x.id === id);
  if (!s) notFound();
  const drills = exercises
    .filter((e) => e.session_id === s.id)
    .sort((a, b) => a.exercise_order - b.exercise_order);

  return <Runner title={s.name} subtitle={`${drills.length} drills`} drills={drills} sessionRef={s.id} />;
}
