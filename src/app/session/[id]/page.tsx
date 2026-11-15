import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { libraryAllowed } from '@/lib/library-gate';
import { speedAllowed } from '@/lib/speed-gate';
import { LibraryLocked } from '@/components/LibraryLocked';
import { getExercises, getPrograms, getSessions } from '@/lib/library';
import { Runner } from '@/components/Runner';
import { serverClient } from '@/lib/supabase/server';
import type { Exercise } from '@/lib/types';
import { splitSessionName } from '@/lib/program-copy';

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

  // "Do it again" from your history. It comes before the library gate: a
  // trainer's session or a speed session is yours to repeat whether or not
  // this academy shows the library.
  if (from === 'history') {
    const again = await fromHistory(id);
    if (again && 'off' in again) return <NotHere what={again.off} />;
    if (again) redirect(again.go);
  }

  if (!(await libraryAllowed())) return <LibraryLocked title="Train" />;
  const exercises = await getExercises();

  if (from === 'history') {
    try {
      const db = await serverClient();
      const { data: w } = await db.from('workouts').select('*').eq('id', id).single();
      if (w) {
        const byId = new Map(exercises.map((e) => [e.id, e]));
        const drills = (w.exercise_ids as string[]).map((id) => byId.get(id)).filter(Boolean) as Exercise[];
        // A saved session is finished by marking that row complete. A finished
        // one is done again as a new session — passing its id made the runner
        // PATCH the old row, so doing a session twice overwrote the first time.
        const again = w.status === 'completed';
        // A built session done more than once through: saved with its rounds
        // since they went into the spec; before that, worked out from the
        // minutes it was saved with.
        const once = drills.reduce((t, d) => t + d.total_seconds, 0);
        const rounds = w.source !== 'coach' ? 1
          : Number(w.spec?.rounds) >= 1 ? Math.floor(Number(w.spec.rounds))
          : once && w.planned_minutes ? Math.max(1, Math.round((w.planned_minutes * 60) / once)) : 1;
        return <Runner title={w.title}
                       drills={drills} rounds={rounds}
                       note={rounds > 1 ? `Do the list ${rounds} times.` : null}
                       workoutId={again ? undefined : w.id}
                       // Whose it is: finishing a saved one offline, or once the
                       // sign-in has lapsed, keeps it on the phone as theirs.
                       owner={w.user_id ?? null}
                       sessionRef={again && w.source === 'library' ? w.source_ref ?? undefined : undefined}
                       back={again ? { href: '/me', label: 'Your training' } : { href: '/me#saved', label: 'Saved for later' }}
                       // Once finished it's in Your training, not Saved for later.
                       doneHref={again ? undefined : '/me'} />;
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

  return <Runner title={splitSessionName(s.name).title} drills={drills}
                 sessionRef={s.id} back={back} />;
}

/**
 * Where a past workout is run again, when its own runner isn't this page:
 * a speed session's drills live in lib/speed.ts, and a trainer's session,
 * week-built session, drill or "just for you" drill has its runner under
 * /train. The workout row only keeps the id (source_ref), so which of the
 * trainer's tables it came from is found by looking.
 */
async function fromHistory(id: string): Promise<{ go: string } | { off: 'library' | 'speed' } | null> {
  const go = (to: string | null) => (to ? { go: to } : null);
  try {
    const db = await serverClient();
    const { data: w } = await db.from('workouts').select('source, source_ref, exercise_ids').eq('id', id).maybeSingle();
    if (!w) return null;
    // Me lists sessions from every academy the player is in, and this one
    // may not open them: Speed turned off here, or no drill library. Its own
    // page would send them on to a locked week that has nothing to do with
    // the session, so it's said plainly instead.
    const library = !w.source || w.source === 'library' || w.source === 'coach';
    if (library && !(await libraryAllowed())) return { off: 'library' };
    if (w.source === 'speed' && !(await speedAllowed().catch(() => true))) return { off: 'speed' };
    const ref = w.source_ref as string | null | undefined;
    if (!ref) return null;
    if (w.source === 'speed') return go(`/speed/session/${ref}?from=history`);
    if (w.source === 'addon') {
      // The trainer may have taken the "just for you" back since: the drill
      // itself is still theirs to do again.
      const { data: x } = await db.from('addons').select('id').eq('id', ref).maybeSingle();
      if (x) return go(`/train/addon/${ref}?from=history`);
      // A trainer's drill is saved as `<drill id>:<place in the list>` (the
      // runner's row id): the drill is the part before the colon.
      const drill = (w.exercise_ids as string[] | null)?.[0]?.split(':')[0];
      const { data: d } = drill ? await db.from('drills').select('id').eq('id', drill).maybeSingle() : { data: null };
      return go(d ? `/train/drill/${drill}?from=history` : null);
    }
    if (w.source !== 'academy') return null;
    for (const [table, kind] of [['academy_sessions', 'session'], ['player_week_sessions', 'custom'], ['drills', 'drill']] as const) {
      const { data } = await db.from(table).select('id').eq('id', ref).maybeSingle();
      if (data) return go(`/train/${kind}/${ref}?from=history`);
    }
  } catch { /* the library lookup below decides */ }
  return null;
}

/** A session from history that this academy can't open, said plainly, with the way back. */
function NotHere({ what }: { what: 'library' | 'speed' }) {
  return (
    <div className="animate-pop pt-10">
      <h1 className="h-page">
        {what === 'speed' ? 'Speed is off here' : 'This session is from somewhere with the drill library'}
      </h1>
      <p className="mt-2 text-body-lg leading-relaxed text-on-surface-variant">
        {what === 'speed'
          ? 'Speed & Stamina is turned off on this page, so it can’t run here. It’s still in your training.'
          : 'It’s built from drills this page doesn’t have, so it can’t run here. It’s still in your training.'}
      </p>
      <Link href="/me" className="btn-primary pressable mt-6 w-full">Back to Your training</Link>
    </div>
  );
}
