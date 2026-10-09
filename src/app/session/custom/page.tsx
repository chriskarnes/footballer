import { redirect } from 'next/navigation';
import { getExercises } from '@/lib/library';
import { Runner } from '@/components/Runner';
import { decodeSession, sessionTitle } from '@/lib/session-url';

/**
 * Runs a session built on Train. It has no id — the drills are in the query
 * string — so it gets its own route beside /session/[id] rather than a magic id.
 *
 * The way back carries the same query string, so it lands on the session you
 * started from rather than on an empty Train screen.
 */
export default async function CustomSessionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
  );
  const decoded = decodeSession(params, await getExercises());
  // A link with nothing usable in it goes to the place that makes sessions.
  if (!decoded) redirect('/');

  const { built } = decoded;
  const drills = `${built.drills.length} drills`;
  return <Runner title={sessionTitle(built.spec)}
                 subtitle={built.rounds > 1 ? `${drills} · ${built.rounds} rounds` : drills}
                 drills={built.drills} rounds={built.rounds}
                 back={{ href: `/?${params.toString()}`, label: 'Your session' }}
                 // Back goes to the session before you start it; Done goes to a
                 // fresh Train. Returning to "Your 20-minute session" after
                 // playing it would offer to start it again.
                 doneHref="/" />;
}
