import { notFound, redirect } from 'next/navigation';
import { libraryAllowed } from '@/lib/branding-server';
import { LibraryLocked } from '@/components/LibraryLocked';
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
  if (!(await libraryAllowed())) return <LibraryLocked title="Train" />;
  const { id } = await params;
  const { from } = await searchParams;
  const exercises = await getExercises();

  if (from === 'history') {
    let speedRef: string | null = null;
    try {
      const db = await serverClient();
      const { data: w } = await db.from('workouts').select('*').eq('id', id).single();
      if (w) {
        // A speed session's drills live in lib/speed.ts, not the library, so
        // its runner is the one that can rebuild them. redirect() throws, and
        // the catch below would swallow it, so it happens after the try.
        if (w.source === 'speed' && w.source_ref) {
          speedRef = w.source_ref;
        } else {
          const byId = new Map(exercises.map((e) => [e.id, e]));
          const drills = (w.exercise_ids as string[]).map((id) => byId.get(id)).filter(Boolean) as Exercise[];
          // A saved session is finished by marking that row complete. A finished
          // one is done again as a new session — passing its id made the runner
          // PATCH the old row, so doing a session twice overwrote the first time.
          const again = w.status === 'completed';
          return <Runner title={w.title}
                         subtitle={again ? 'Doing it again' : 'Saved session'}
                         drills={drills}
                         workoutId={again ? undefined : w.id}
                         sessionRef={again && w.source === 'library' ? w.source_ref ?? undefined : undefined}
                         back={{ href: '/me', label: 'Your training' }} />;
        }
      }
    } catch { /* fall through to library lookup */ }
    if (speedRef) redirect(`/speed/session/${speedRef}?from=history`);
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
  //
  // Unless it was started from your week — from Plan, or from Train's "today"
  // card — in which case that's where you came from and where Done returns:
  // landing in a library program you never opened would be a strange way to
  // finish a session your plan gave you.
  const program = programs.find((p) => p.id === s.program_id);
  const back =
    from === 'plan' ? { href: '/plan', label: 'Your week' }
    : from === 'train' ? { href: '/', label: 'Train' }
    : program ? { href: `/library/${program.id}`, label: program.name }
    : { href: '/library', label: 'Library' };

  return <Runner title={s.name} subtitle={`${drills.length} drills`} drills={drills}
                 sessionRef={s.id} back={back} />;
}
