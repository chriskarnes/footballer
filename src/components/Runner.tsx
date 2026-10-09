'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { Exercise } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';
import { formatTouches } from '@/lib/session-builder';
import { haptic } from '@/lib/haptics';
import { useWakeLock } from '@/lib/use-wake-lock';
import { stashWorkout } from '@/lib/pending-workout';
import { BackLink } from './BackLink';

type Phase = 'running' | 'confirm-end' | 'finished';
/** What became of the finished session. `signin` means it's waiting in this
 *  browser for an account — see pending-workout.ts. */
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
  title, subtitle, drills, workoutId, sessionRef, back, doneHref, rounds = 1,
}: {
  title: string; subtitle: string; drills: Exercise[];
  workoutId?: string; sessionRef?: string;
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
    setDone((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); haptic('tap'); }
      else { n.add(id); haptic('select'); }
      return n;
    });
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
      : { title, source: sessionRef ? 'library' : 'coach', source_ref: sessionRef,
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
      if (res.status === 401 && !workoutId) { stashWorkout(body); setSave('signin'); }
      else setSave(res.ok ? 'saved' : 'error');
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

  if (finished) {
    return (
      <div className="animate-pop">
        <p className="eyebrow mb-3">{title}</p>
        {/* Ended early is still a session. The headline says what happened
            without grading it; the numbers underneath carry the difference. */}
        <h1 className="h-hero">{allDone ? 'Session complete' : 'Session done'}</h1>

        {/* The celebration, now on Finish rather than the last tick: the card
            lands, the tick draws. Same motion as before, one moment later. */}
        <div className="celebrate mt-6 rounded-large-increased border border-brand-edge bg-surface-brand p-6 shadow-level3">
          <div className="flex items-end gap-3">
            <svg viewBox="0 0 24 24" aria-hidden="true"
                 className="mb-1 h-9 w-9 shrink-0 text-on-surface-brand"
                 fill="none" stroke="currentColor" strokeWidth="3"
                 strokeLinecap="round" strokeLinejoin="round">
              <path className="celebrate-tick" d="M20 6 9 17l-5-5" />
            </svg>
            <div>
              <div className="font-brand text-[40px] font-extrabold leading-none
                              tracking-tightest text-on-surface-brand">
                {done.size}<span className="text-on-surface-brand-variant">/{drills.length}</span>
              </div>
              <div className="mt-1.5 text-[12.5px] font-semibold text-on-surface-brand-variant">
                drills done
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-brand-edge pt-5">
            <Metric v={formatTouches(doneTouches)} unit="ball touches" />
            <Metric v={`${played}`} unit={played === 1 ? 'minute' : 'minutes'} />
          </div>

          {/* What became of it, said plainly — and if it's waiting on an
              account, what signing in does with it. */}
          <p role="status" className="mt-5 text-[13px] font-medium text-on-surface-brand-variant">
            {save === 'saving' && 'Saving…'}
            {save === 'saved' && (
              <>Saved to <Link href="/me" className="font-bold text-on-surface-brand underline underline-offset-4">your training</Link>.</>
            )}
            {save === 'signin' && (
              <><Link href="/me" className="font-bold text-on-surface-brand underline underline-offset-4">Sign in</Link> and
              this session is saved to your training.</>
            )}
            {save === 'error' && (
              <>Couldn&rsquo;t save this session.{' '}
                <button type="button" onClick={() => send(played)}
                        className="font-bold text-on-surface-brand underline underline-offset-4">
                  Try again
                </button>
              </>
            )}
          </p>
        </div>

        {/* The way out. The ticked list has nothing left to say, so it's gone,
            and this is the one thing on the screen to press. */}
        <Link href={doneHref ?? back?.href ?? '/'} className="btn-primary pressable mt-6 w-full">
          Done
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-pop">
      {back && <BackLink href={back.href} label={back.label} />}
      <p className="eyebrow mb-3">{subtitle}</p>
      <h1 className="h-page">{title}</h1>

      {/* Live progress. Drills lead, touches follow.
          What a player is doing on this screen is working through a list, and
          the number that answers "how much is left" is the one they are
          actually moving — a drill at a time. Touches banked led before and
          could not do that job: it jumps 150 at a time, it is an estimate, and
          it never reaches a number anyone recognises as finished. The bar has
          always been drawn from the drill count, so the headline now agrees
          with the bar underneath it. */}
      <div className="mt-6 rounded-large-increased bg-surface-brand border border-brand-edge p-6 shadow-level3">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-brand text-[40px] font-extrabold leading-none
                            tracking-tightest text-on-surface-brand">
              {done.size}<span className="text-on-surface-brand-variant">/{drills.length}</span>
            </div>
            <div className="mt-1.5 text-[12.5px] font-semibold text-on-surface-brand-variant">
              {allDone ? 'all drills done' : 'completed drills'}
            </div>
          </div>
          {/* Touches, at one weight and in the quiet tone. The banked count used
              to sit above this in bold white, which put a second headline
              number on a card that only has room for one. */}
          <div className="text-right text-[11.5px] font-semibold text-on-surface-brand-variant">
            {formatTouches(doneTouches)} of {formatTouches(totalTouches)} touches
          </div>
        </div>
        <div className="mt-5 h-[6px] overflow-hidden rounded-full bg-brand-track">
          <div className="h-full rounded-full bg-on-surface-brand transition-all duration-500"
               style={{ width: `${pct}%` }} />
        </div>

        {/* Finish is the one primary button that sits ON the brand block, so its
            fill and label swap: a black button on a black card is not a button. */}
        {allDone && (
          <button onClick={finish}
                  className="btn-primary pressable animate-pop mt-5 w-full bg-on-surface-brand text-surface-brand">
            Finish session
          </button>
        )}

        {/* Ending early. It used to be impossible: Finish only existed at 100%,
            so stopping at four of six logged nothing and held the screen awake
            until you left the page. Quiet until asked, and asked twice, since
            it ends the session on a tap. */}
        {!allDone && done.size > 0 && phase === 'running' && (
          <button onClick={() => setPhase('confirm-end')}
                  className="btn-ghost pressable mt-5 border-on-surface-brand-variant text-on-surface-brand">
            End early
          </button>
        )}
        {!allDone && done.size > 0 && phase === 'confirm-end' && (
          <div className="hint-in mt-5">
            <p className="text-[13px] font-medium text-on-surface-brand">
              End with {done.size} of {drills.length} drills done?
            </p>
            <div className="mt-3 flex gap-2.5">
              <button onClick={() => setPhase('running')}
                      className="btn-ghost pressable min-h-[52px] flex-1 border-on-surface-brand-variant text-on-surface-brand">
                Keep going
              </button>
              <button onClick={finish}
                      className="btn-primary pressable flex-1 bg-on-surface-brand text-surface-brand">
                End session
              </button>
            </div>
          </div>
        )}
      </div>

      <ol className="stagger mt-4 space-y-2.5">
        {drills.map((d) => {
          const on = done.has(d.id);
          return (
            <li key={d.id} onClick={() => toggle(d.id)}
                role="button" tabIndex={0} aria-pressed={on}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(d.id); }
                }}
                className={`card pressable flex cursor-pointer items-start gap-3.5 p-4
                            ${on ? 'opacity-45' : ''}`}>
              {/* A ticked drill is a selection, not a brand block, so it takes
                  the selection pair and flips with the scheme — same as a
                  chosen chip and the navigation pill. */}
              <div className={`mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center
                               rounded-[9px] border-2 transition
                               ${on ? 'border-secondary-container bg-transparent' : 'border-outline-variant bg-surface-container-low'}`}>
                {on && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-secondary-container" fill="none"
                       stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
                       strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`h-card ${on ? 'line-through' : ''}`}>{d.name}</div>
                <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
                  {d.sets} × {d.reps_time}{d.rest && d.rest !== '-' ? ` · rest ${d.rest}` : ''}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="tag tag-accent">{FOCUS_LABELS[d.primary_focus]}</span>
                  {!!d.touches && <span className="tag">{formatTouches(d.touches)} touches</span>}
                </div>
              </div>
              {d.video_url && (
                <a href={d.video_url} target="_blank" rel="noopener" aria-label="Watch demo"
                   onClick={(e) => e.stopPropagation()}
                   className="icon-btn pressable">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Metric({ v, unit }: { v: string; unit: string }) {
  return (
    <div>
      <div className="font-brand text-[22px] font-bold leading-none tracking-tighter text-on-surface-brand">{v}</div>
      <div className="mt-1 text-[11.5px] font-semibold text-on-surface-brand-variant">{unit}</div>
    </div>
  );
}
