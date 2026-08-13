import { notFound } from 'next/navigation';
import { getExercises, getPrograms, getSessions } from '@/lib/library';
import { Runner } from '@/components/Runner';
import { serverClient } from '@/lib/supabase/server';
import type { Exercise } from '@/lib/types';

/**
 * One route serves both a library session and a saved workout ("do it again"),
 * because to the player they're the same thing: a list of drills to tick off.
 *
 * The two arrive from different places, though, so the way out differs too. A
 * library session belongs to a program; a repeat belongs to your history. The
 * runner fills the screen and the tab bar leads to neither, so getting this
 * wrong leaves the deepest page in the app with no way back up.
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
                       drills={drills} workoutId={w.id}
                       back={{ href: '/me', label: 'Your training' }} />;
      }
    } catch { /* fall through to library lookup */ }
  }

  const [sessions, programs] = await Promise.all([getSessions(), getPrograms()]);
  const s = sessions.find((x) => x.id === id);
  if (!s) notFound();
  const drills = exercises
    .filter((e) => e.session_id === s.id)
    .sort((a, b) => a.exercise_order - b.exercise_order);

  // Name the program rather than saying "Back": the label should tell you where
  // you land. Falls back to the Library if the program has gone missing, so a
  // stale session id still leaves you somewhere rather than nowhere.
  const program = programs.find((p) => p.id === s.program_id);
  const back = program
    ? { href: `/library/${program.id}`, label: program.name }
    : { href: '/library', label: 'Library' };

  return <Runner title={s.name} subtitle={`${drills.length} drills`} drills={drills}
                 sessionRef={s.id} back={back} />;
}
