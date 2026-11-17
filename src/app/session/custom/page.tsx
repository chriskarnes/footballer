import { redirect } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { trainingLocked } from '@/lib/membership-server';
import { TrainingLocked } from '@/components/TrainingLocked';
import { libraryAllowed } from '@/lib/library-gate';
import { LibraryLocked } from '@/components/LibraryLocked';
import { getExercises } from '@/lib/library';
import { Runner } from '@/components/Runner';
import { decodeSession, sessionTitle } from '@/lib/session-url';
import { getViewer } from '@/lib/viewer';

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
  // Not for a player whose free days are over or who is switched off: the
  // page itself holds nothing for them, whatever the frame shows.
  if (await trainingLocked()) return <TrainingLocked />;
  // The tab bar is hidden on session pages, so this needs its own way out.
  if (!(await libraryAllowed())) return <><div className="pt-6"><BackLink href="/" label="Train" /></div><LibraryLocked title="Train" /></>;
  const raw = await searchParams;
  const params = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
  );
  const decoded = decodeSession(params, await getExercises());
  // A link with nothing usable in it goes to the place that makes sessions.
  if (!decoded) redirect('/');

  const { built } = decoded;
  // Who's signed in, so a finish with no signal is kept as theirs.
  const owner = (await getViewer().catch(() => null))?.user?.id ?? null;
  return <Runner title={sessionTitle(built.spec)} owner={owner}
                 note={built.rounds > 1 ? `Do the list ${built.rounds} times.` : null}
                 drills={built.drills} rounds={built.rounds}
                 spec={{ ...built.spec, rounds: built.rounds }}
                 back={{ href: `/?${params.toString()}`, label: 'Your session' }}
                 // Back goes to the session before you start it; Done goes to a
                 // fresh Train. Returning to "Your 20-minute session" after
                 // playing it would offer to start it again.
                 doneHref="/" />;
}
