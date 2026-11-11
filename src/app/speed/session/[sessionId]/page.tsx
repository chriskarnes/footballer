import { notFound } from 'next/navigation';
import { Runner } from '@/components/Runner';
import { KIND_LABELS, phaseById, sessionExercises, speedSessionById } from '@/lib/speed';

/**
 * A speed session in the Runner, the same screen every other session uses.
 * The drills arrive as Exercises through asExercise(), so ticking, timing and
 * saving all work; the only visible differences are the coaching cue under
 * each drill and no demo video.
 */
export default async function SpeedSessionPage({
  params, searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { sessionId } = await params;
  const { from } = await searchParams;
  const s = speedSessionById(sessionId);
  if (!s) notFound();
  const phase = phaseById(s.phase)!;

  // Back goes where you came from: history, the Speed tab's "today", or the
  // phase you were browsing.
  const back =
    from === 'history' ? { href: '/me', label: 'Your training' }
    : from === 'speed' ? { href: '/speed', label: 'Speed' }
    : { href: `/speed/${phase.id}`, label: phase.name };

  return (
    <Runner
      title={s.name}
      drills={sessionExercises(s)}
      sessionRef={s.id}
      source="speed"
      back={back}
    />
  );
}
