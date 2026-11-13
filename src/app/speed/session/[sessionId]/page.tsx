import { notFound } from 'next/navigation';
import { Runner } from '@/components/Runner';
import { KIND_LABELS, phaseById, sessionExercises, speedSessionById } from '@/lib/speed';
import { serverClient } from '@/lib/supabase/server';

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

  // When it was finished lately, the way the Speed page reads it. Whether
  // that's this week is the player's own week, so the runner decides.
  let completedAt: string[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const db = await serverClient();
      const { data: auth } = await db.auth.getUser();
      if (auth.user) {
        const { data } = await db.from('workouts').select('completed_at')
          .eq('status', 'completed').eq('source', 'speed').eq('source_ref', s.id)
          .gte('completed_at', new Date(Date.now() - 8 * 86400000).toISOString());
        completedAt = (data ?? []).map((r: { completed_at: string | null }) => r.completed_at).filter(Boolean) as string[];
      }
    } catch { /* not configured */ }
  }

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
      // From history it's "do it again": open ready to start, not on Completed.
      completedAt={from === 'history' ? [] : completedAt}
    />
  );
}
