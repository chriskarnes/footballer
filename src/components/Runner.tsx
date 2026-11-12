'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { Exercise } from '@/lib/types';
import { haptic } from '@/lib/haptics';
import { useWakeLock } from '@/lib/use-wake-lock';
import { pendingWorkout } from '@/lib/pending';
import { EFFORT } from '@/lib/speed-guide';
import { BackLink } from './BackLink';

type Phase = 'running' | 'confirm-end' | 'finished';
/** What became of the finished session. `signin` means it's waiting in this
 *  browser for an account — see pending.ts. */
type Save = 'saving' | 'saved' | 'signin' | 'error';

/**
 * Time is counted from the first tick, backdated by that drill's own length —
 * the first tick lands when the first drill ENDS, and time spent reading the
 * list before starting isn't training. Capped at twice the plan, because a
 * phone left on the grass with the tab open is not a three-hour session.
 */
function playedMinutes(startedAt: number | null, openedAt: number, plannedSeconds: number): number {
  if (startedAt === null) return 0;
  const ms = Math.max(0, Date.now() - Math.max(startedAt, openedAt));
  return Math.max(1, Math.round(Math.min(ms / 1000, plannedSeconds * 2) / 60));
}

export function Runner({
  title, note, drills, workoutId, sessionRef, back, doneHref, rounds = 1, source, doneOn,
}: {
  title: string; drills: Exercise[];
  /** When they last finished this one, in words ("Monday"), if they have this week. */
  doneOn?: string | null;
  /** One line under the title, when there's something to say: a trainer's
   *  note on a drill set just for them, or how many rounds. */
  note?: string | null;
  workoutId?: string; sessionRef?: string;
  /** Where the drills came from. Defaults to library when there's a sessionRef,
   *  coach otherwise. 'speed' drills aren't library rows, so history keeps the
   *  session but not per-drill ticks — see /api/workouts. */
  source?: 'library' | 'coach' | 'speed' | 'academy' | 'addon';
  /** A short coach circuit is done more than once. A drill is ticked when every
   *  round of it is done, so only the totals need to know. */
  rounds?: number;
  /** Where this session was opened from. The runner fills the screen and the tab
   *  bar does not lead back to the program, so without this it is a dead end. */
  back?: { href: string; label: string };
  /** Where Done goes once the session is over. Defaults to `back` — a library
   *  session returns to its program, where the next session is. */
  doneHref?: string;
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('running');
  const [save, setSave] = useState<Save>('saving');
  const [played, setPlayed] = useState(0);
  // A trainer's session asks how it felt: that's what steps the next week up.
  const [savedId, setSavedId] = useState<string | null>(workoutId ?? null);
  const [feel, setFeel] = useState<'easy' | 'right' | 'hard' | null>(null);
  const asksFeel = source === 'academy' || source === 'addon';
  // Which step is open. The first to begin with; ticking one opens the next,
  // so the list walks the player through itself.
  const [howOpen, setHowOpen] = useState<string | null>(drills[0]?.id ?? null);
  const openedAt = useRef(Date.now());
  const startedAt = useRef<number | null>(null);

  const total = drills.reduce((a, d) => a + d.total_seconds, 0) * rounds;
  const totalTouches = drills.reduce((a, d) => a + d.touches, 0) * rounds;
  const doneTouches = drills.filter((d) => done.has(d.id)).reduce((a, d) => a + d.touches, 0) * rounds;
  const pct = drills.length ? Math.round((done.size / drills.length) * 100) : 0;
  const allDone = drills.length > 0 && done.size === drills.length;
  const finished = phase === 'finished';

  // Hold the screen open until the session is over. The phone is on the ground
  // against a cone for most of this; on the summary it can sleep.
  useWakeLock(!finished);

  const toggle = (id: string) => {
    if (finished) return;
    const d = drills.find((x) => x.id === id);
    if (startedAt.current === null && d) {
      startedAt.current = Date.now() - d.total_seconds * rounds * 1000;
    }
    const ticking = !done.has(id);
    haptic(ticking ? 'select' : 'tap');
    const n = new Set(done);
    if (ticking) n.add(id); else n.delete(id);
    setDone(n);
    // Done: on to the next one still to do, after this one first. Undone: back to it.
    const at = drills.findIndex((x) => x.id === id);
    const nextUp = [...drills.slice(at + 1), ...drills.slice(0, at)].find((x) => !n.has(x.id));
    setHowOpen(ticking ? nextUp?.id ?? null : id);
    // Unticking the last drill takes back an "end early" that was about to
    // become "end with nothing done".
    if (phase === 'confirm-end') setPhase('running');
  };

  async function send(minutes: number) {
    setSave('saving');
    const completed_at = new Date().toISOString();
    const doneIds = drills.filter((d) => done.has(d.id)).map((d) => d.id);
    const body = workoutId
      ? { id: workoutId, doneIds, actual_minutes: minutes, actual_touches: doneTouches }
      : { title, source: source ?? (sessionRef ? 'library' : 'coach'), source_ref: sessionRef,
          exercise_ids: drills.map((d) => d.id), done_ids: doneIds,
          planned_minutes: Math.round(total / 60), planned_touches: totalTouches,
          actual_minutes: minutes, actual_touches: doneTouches,
          status: 'completed', completed_at };
    try {
      const res = await fetch('/api/workouts', {
        method: workoutId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      // This used to say "Saved to your history" whatever came back, and Train
      // needs no account — so most first sessions were reported saved and
      // weren't. A signed-out finish is kept in this browser until sign-in.
      if (res.status === 401 && !workoutId) { pendingWorkout.stash(body); setSave('signin'); }
      else {
        setSave(res.ok ? 'saved' : 'error');
        if (res.ok && !workoutId) { const j = await res.json().catch(() => null); if (j?.id) setSavedId(j.id); }
      }
    } catch { setSave('error'); }
  }

  function finish() {
    const minutes = playedMinutes(startedAt.current, openedAt.current, total);
    setPlayed(minutes);
    setPhase('finished');
    // The success buzz moved here from the last tick: Finish is the moment, and
    // marking the tick before it left the button itself feeling like an
    // afterthought.
    haptic('success');
    window.scrollTo({ top: 0 });
    send(minutes);
  }

  const Tick = ({ className }: { className: string }) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor"
         strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path className="celebrate-tick" d="M20 6 9 17l-5-5" /></svg>
  );

  if (finished) {
    return (
      <div className="animate-pop">
        {/* Ended early is still a session: the headline cheers either way, and
            the count underneath carries the difference. */}
        <div className="celebrate mt-4 rounded-large-increased border border-brand-edge bg-surface-brand px-6 py-9 text-center shadow-level3">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }}>
            <Tick className="h-8 w-8" />
          </span>
          <h1 className="site-wide mt-5 text-[32px] uppercase leading-none text-on-surface-brand">
            {allDone ? 'Nice work!' : 'Good effort!'}
          </h1>
          <p className="mt-3 text-[17px] font-semibold text-on-surface-brand-variant">
            {done.size} of {drills.length} drills · {played} min
          </p>

          {/* Said only when there's something to do about it. */}
          {(save === 'signin' || save === 'error') && (
            <p role="status" className="mt-4 text-[14px] font-medium text-on-surface-brand-variant">
              {save === 'signin' ? (
                <><Link href="/me" className="font-bold text-on-surface-brand underline underline-offset-4">Sign in</Link> to keep this session.</>
              ) : (
                <>Couldn&rsquo;t save.{' '}
                  <button type="button" onClick={() => send(played)}
                          className="font-bold text-on-surface-brand underline underline-offset-4">Try again</button>
                </>
              )}
            </p>
          )}
        </div>

        {asksFeel && savedId && (
          <div className="mt-7">
            <h2 className="h-sec text-center">{feel ? 'Thanks!' : 'How was it?'}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2.5" role="group" aria-label="How was it?">
              {([['easy', 'Easy'], ['right', 'Just right'], ['hard', 'Hard']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={feel === k}
                        className={`pressable min-h-[60px] rounded-2xl border-2 text-[15px] font-bold
                                    ${feel === k ? 'border-on-surface bg-on-surface text-surface' : 'border-outline text-on-surface'}`}
                        onClick={() => {
                          setFeel(k); haptic('tap');
                          fetch('/api/workouts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: savedId, feel: k }) }).catch(() => {});
                        }}>{l}</button>
              ))}
            </div>
          </div>
        )}

        <Link href={doneHref ?? back?.href ?? '/'} className="btn-primary btn-big pressable mt-7 w-full">
          Done
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-pop">
      {back && <BackLink href={back.href} label={back.label} />}
      <h1 className="h-page">{title}</h1>
      {note && <p className="mt-2 text-[16px] font-medium leading-snug text-on-surface-variant">{note}</p>}

      {/* How far through: one number and a bar. It stays in view while the
          list scrolls under it, so "how much is left" is never a scroll away. */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+8px)] z-10 mt-5 rounded-2xl border border-brand-edge bg-surface-brand px-5 py-4 shadow-level2">
        <div className="flex items-baseline justify-between text-on-surface-brand">
          <span className="font-brand text-[22px] font-extrabold leading-none tracking-tighter">
            {done.size} of {drills.length}
          </span>
          <span className="text-[14px] font-bold text-on-surface-brand-variant">{allDone ? 'All done!' : 'done'}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-track">
          <div className="h-full rounded-full bg-brand-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Reopened after finishing it: say so. The list below is how to do it again. */}
      {doneOn && !done.size && (
        <div className="mt-4 flex items-center gap-3.5 rounded-2xl border-2 border-on-surface px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-on-surface text-surface">
            <Tick className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[17px] font-extrabold text-on-surface">Completed</span>
            <span className="block text-[14.5px] font-semibold text-on-surface-variant">
              You did this {doneOn}. Want to do it again?
            </span>
          </span>
        </div>
      )}

      <ol className="stagger mt-4 space-y-3">
        {drills.map((d, i) => {
          const on = done.has(d.id);
          const open = howOpen === d.id;
          return (
            <li key={d.id} className={`card overflow-hidden ${open ? 'ring-2 ring-on-surface' : ''}`}>
              <div className={`flex items-center gap-3 p-4 transition-opacity ${on && !open ? 'opacity-50' : ''}`}>
                {/* The card opens the step. Only the circle ticks it off. */}
                <button type="button" aria-expanded={open} onClick={() => setHowOpen(open ? null : d.id)}
                        className="pressable flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-on-surface-variant">Step {i + 1}</span>
                    <span className="block text-[18px] font-bold leading-snug text-on-surface">{d.name}</span>
                    <span className="mt-0.5 block text-[15px] font-semibold text-on-surface-variant">
                      {/* "rest 1 min", but just "walk back": a rest that's an
                          instruction rather than a time doesn't take "rest". */}
                      {d.amount ?? `${d.sets} × ${d.reps_time}${d.rest && d.rest !== '-'
                        ? (/^\d/.test(d.rest) ? ` · rest ${d.rest}` : ` · ${d.rest}`) : ''}`}
                      {d.effort && ` · ${EFFORT[d.effort].label}`}
                    </span>
                  </span>
                </button>
                {/* Not done: a ring with a faint tick in it, which reads as
                    "tick me" where an empty ring read as nothing at all. */}
                <button type="button" aria-pressed={on} onClick={() => toggle(d.id)}
                        aria-label={on ? `${d.name}: done. Tap to undo` : `Mark ${d.name} done`}
                        className={`pressable flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] transition
                                    ${on ? 'border-on-surface bg-on-surface text-surface' : 'border-on-surface bg-surface-container-low text-outline'}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor"
                       strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </button>
              </div>

              {/* Show me how: the cue, the steps, the video, and the button
                  that ticks it off and moves on. Videos sit last so there is
                  room for more than one. */}
              {open && (
                <div className="hint-in border-t border-outline-variant px-4 pb-4 pt-4">
                  {(!!d.how?.length || d.cue || d.video_url) && <h3 className="h-sec mb-3">Show me how</h3>}
                  {d.cue && <p className="mb-3 text-[16px] font-semibold text-on-surface">&ldquo;{d.cue}&rdquo;</p>}
                  {!!d.how?.length && (
                    <ol className="space-y-3">
                      {d.how.map((step, n) => (
                        <li key={n} className="flex gap-3 text-[16px] leading-snug text-on-surface">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[14px] font-extrabold">{n + 1}</span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {d.effort && !!d.how?.length && (
                    <p className="mt-3 text-[15px] text-on-surface-variant">
                      <span className="font-bold text-on-surface">{EFFORT[d.effort].label}:</span>{' '}
                      {EFFORT[d.effort].means}
                    </p>
                  )}
                  {d.video_url && (
                    <div className={d.how?.length || d.cue ? 'mt-4' : ''}>
                      <Watch href={d.video_url} className="btn-ghost pressable min-h-[52px] w-full gap-2 text-[15px] font-bold" />
                    </div>
                  )}
                  {!on && (
                    <button type="button" onClick={() => toggle(d.id)}
                            className={`btn-primary btn-big pressable w-full ${d.how?.length || d.cue || d.video_url ? 'mt-4' : ''}`}>
                      I did it
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* The way out is where the list ends, which is where the last tick was. */}
      {allDone && (
        <button onClick={finish} className="btn-primary btn-big pressable animate-pop mt-6 w-full">
          Finish
        </button>
      )}
      {!allDone && done.size > 0 && phase === 'running' && (
        <button onClick={() => setPhase('confirm-end')}
                className="btn-ghost pressable mt-6 min-h-[52px] w-full text-[15px] font-bold">
          Stop early
        </button>
      )}
      {!allDone && done.size > 0 && phase === 'confirm-end' && (
        <div className="hint-in card mt-6 p-5">
          <p className="h-sec">Stop now?</p>
          <div className="mt-4 flex gap-2.5">
            <button onClick={() => setPhase('running')} className="btn-ghost pressable min-h-[52px] flex-1 font-bold">
              Keep going
            </button>
            <button onClick={finish} className="btn-primary pressable flex-1">
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Watch({ href, className }: { href: string; className: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={className}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
      Watch the video
    </a>
  );
}
