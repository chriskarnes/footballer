'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Exercise } from '@/lib/types';
import { haptic } from '@/lib/haptics';
import { useWakeLock } from '@/lib/use-wake-lock';
import { pendingWorkout } from '@/lib/pending';
import { EFFORT } from '@/lib/speed-guide';
import { isYoutubeShort, youtubeId } from '@/lib/video';
import { Avatar } from './Avatar';
import { BackLink } from './BackLink';
import { Tick, TickMark } from './TickMark';

type Phase = 'running' | 'confirm-end' | 'finished';
/** What became of the finished session. `signin` means it's waiting in this
 *  browser for an account — see pending.ts. */
type Save = 'saving' | 'saved' | 'signin' | 'error';
type Trainer = { name: string | null; photo: string | null };
type Feel = 'easy' | 'right' | 'hard';

// How the session felt, onto the saved session. Nothing to say if it fails:
// it's a nice-to-have on top of a session that's already kept.
function sendFeel(id: string, feel: Feel) {
  fetch('/api/workouts', {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, feel }), keepalive: true,
  }).catch(() => {});
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * The minutes a session counts for: the planned length of the drills ticked.
 * It used to be the time between ticks, and players train with the phone in
 * a bag and tick the lot at the end, so a 20-minute session went down as
 * one. A drill done counts for its length, however fast the ticks were.
 */
function tickedMinutes(drills: Exercise[], done: Set<string>, rounds: number): number {
  const seconds = drills.filter((d) => done.has(d.id)).reduce((a, d) => a + d.total_seconds, 0) * rounds;
  return seconds ? Math.max(1, Math.round(seconds / 60)) : 0;
}

/** Whether a drill opens to show how: steps, or a video that plays here. */
const showable = (d: Exercise | undefined) => !!d && (!!d.how?.length || !!youtubeId(d.video_url));

/** The weekday (Monday 0) of the first of these in the player's own week, or null. */
function firstThisWeek(at: string[], now = new Date()): number | null {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const times = at.map((a) => new Date(a)).filter((t) => t >= monday && t <= now).sort((a, b) => +a - +b);
  return times.length ? (times[0].getDay() + 6) % 7 : null;
}

/** Scrolls to an element once React has drawn it; no glide for anyone who asked for less motion. */
function glide(el: () => Element | null | undefined, block: ScrollLogicalPosition = 'start') {
  requestAnimationFrame(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el()?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block });
  });
}

export function Runner({
  title, note, drills, workoutId, sessionRef, back, doneHref, rounds = 1, source,
  completedDay = null, completedAt, trainer,
}: {
  title: string; drills: Exercise[];
  /** One line under the title, when there's something to say: the trainer's
   *  note on this session or on a drill set just for them, or how many rounds.
   *  With a trainer, it's in their words, beside their face. */
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
  /** Done already this week: the weekday it was finished (Monday 0), from the
   *  same week Train reads. It opens as done, with Do it again. */
  completedDay?: number | null;
  /** The same for Speed: when it was finished lately. Whether that's this week
   *  is the player's own week, so it's worked out here, once on the phone. */
  completedAt?: string[];
  /** The trainer, when the drills are theirs and a player is looking: their
   *  face once, under the title, and their name on the finish. */
  trainer?: Trainer;
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('running');
  const [save, setSave] = useState<Save>('saving');
  const [played, setPlayed] = useState(0);
  // A trainer's session asks how it felt: that's what steps the next week up.
  const [savedId, setSavedId] = useState<string | null>(workoutId ?? null);
  const [feel, setFeel] = useState<Feel | null>(null);
  // The feel can be picked while the save is still on its way: it rides along
  // as soon as there's a session to put it on, even if they've left by then.
  const feelRef = useRef<Feel | null>(null);
  const asksFeel = source === 'academy' || source === 'addon';
  // Done already this week: shown done, every drill ticked and nothing to
  // change, until they choose to go again. A redo is a new session of its
  // own: it counts for This week and their trainer sees it, and the week's
  // tick stays where it was.
  const [doneDay, setDoneDay] = useState<number | null>(completedDay);
  const [checked, setChecked] = useState(!completedAt?.length);
  const review = doneDay !== null;
  // Which drill is open to show how. One at a time: the list is the
  // thing being worked through. A run starts with the first one open.
  const [howOpen, setHowOpen] = useState<string | null>(
    () => (completedDay === null && showable(drills[0]) ? drills[0].id : null));
  const rows = useRef(new Map<string, HTMLLIElement>());
  const finishRef = useRef<HTMLButtonElement>(null);

  const doneKey = completedAt?.join() ?? '';
  useEffect(() => {
    if (!doneKey) return;
    const day = firstThisWeek(doneKey.split(','));
    if (day !== null) { setDoneDay(day); setHowOpen(null); }
    setChecked(true);
  }, [doneKey]);

  const total = drills.reduce((a, d) => a + d.total_seconds, 0) * rounds;
  const totalTouches = drills.reduce((a, d) => a + d.touches, 0) * rounds;
  const doneTouches = drills.filter((d) => done.has(d.id)).reduce((a, d) => a + d.touches, 0) * rounds;
  const pct = drills.length ? Math.round((done.size / drills.length) * 100) : 0;
  const allDone = drills.length > 0 && done.size === drills.length;
  const finished = phase === 'finished';
  // The drill to tick next: its circle breathes.
  const current = review ? null : drills.find((d) => !done.has(d.id))?.id ?? null;

  // Hold the screen open while they train. The phone is on the ground against
  // a cone for most of this; on the summary, or a session already done, it
  // can sleep.
  useWakeLock(!finished && !review);

  const toggle = (id: string) => {
    if (finished || review) return;
    const next = new Set(done);
    const ticking = !next.has(id);
    if (ticking) { next.add(id); haptic('select'); } else { next.delete(id); haptic('tap'); }
    setDone(next);
    // Unticking the last drill takes back an "end early" that was about to
    // become "end with nothing done".
    if (phase === 'confirm-end') setPhase('running');
    // Unticking moves nothing. A tick moves on to the next drill still to
    // do, after this one: it opens, just under the progress bar. After the
    // last, everything closes and Finish comes up.
    if (!ticking) return;
    const i = drills.findIndex((x) => x.id === id);
    const after = [...drills.slice(i + 1), ...drills.slice(0, i)].find((x) => !next.has(x.id));
    if (!after) { setHowOpen(null); glide(() => finishRef.current, 'center'); return; }
    setHowOpen(showable(after) ? after.id : null);
    glide(() => rows.current.get(after.id));
  };

  const again = () => {
    haptic('tap');
    setDoneDay(null);
    setDone(new Set());
    setHowOpen(showable(drills[0]) ? drills[0].id : null);
    window.scrollTo({ top: 0 });
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
        if (res.ok && !workoutId) {
          const j = await res.json().catch(() => null);
          if (j?.id) { setSavedId(j.id); if (feelRef.current) sendFeel(j.id, feelRef.current); }
        }
      }
    } catch { setSave('error'); }
  }

  const pickFeel = (k: Feel) => {
    setFeel(k); feelRef.current = k; haptic('tap');
    if (savedId) sendFeel(savedId, k);
  };

  function finish() {
    const minutes = tickedMinutes(drills, done, rounds);
    setPlayed(minutes);
    setPhase('finished');
    // The success buzz moved here from the last tick: Finish is the moment, and
    // marking the tick before it left the button itself feeling like an
    // afterthought.
    haptic('success');
    window.scrollTo({ top: 0 });
    send(minutes);
  }

  // Their trainer, by name where it's known: "Mike will see this".
  const face = !!trainer && (!!trainer.name || !!trainer.photo);
  const who = trainer?.name ?? 'your trainer';

  if (finished) {
    const ask = feel ? 'Thanks!' : trainer ? `Tell ${who} how it was` : 'How was it?';
    return (
      <div className="animate-pop">
        {/* Ended early is still a session: the headline cheers either way, and
            the count underneath carries the difference. */}
        <div className="celebrate mt-4 brand-card px-6 py-9 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full accent-badge">
            <Tick className="h-8 w-8" draw />
          </span>
          <h1 className="site-wide mt-5 text-headline-lg uppercase leading-none text-on-surface-brand">
            {allDone ? 'Nice work!' : 'Good effort!'}
          </h1>
          <p className="mt-3 text-title font-semibold text-on-surface-brand-variant">
            {done.size} of {drills.length} drills · {played} min
          </p>

          {/* A trainer's session goes to the trainer: say so, while it's on its
              way or there. If it didn't save, the line below says that instead. */}
          {trainer && asksFeel && (save === 'saving' || save === 'saved') && (
            <div className="mt-5 flex items-center justify-center gap-2.5">
              {face && <Avatar name={trainer.name} src={trainer.photo} className="h-9 w-9 text-body" onBrand />}
              <p className="text-title-sm font-bold text-on-surface-brand">
                {trainer.name ?? 'Your trainer'} will see this
              </p>
            </div>
          )}

          {/* Said only when there's something to do about it. */}
          {(save === 'signin' || save === 'error') && (
            <p role="status" className="mt-4 text-body font-medium text-on-surface-brand-variant">
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

        {/* Asked straight away, above the button: not after the save is back. */}
        {asksFeel && save !== 'signin' && (
          <div className="mt-7">
            <h2 className="h-sec text-center">{ask}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2.5" role="group" aria-label={ask}>
              {([['easy', 'Easy'], ['right', 'Just right'], ['hard', 'Hard']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={feel === k}
                        className={`pressable min-h-[60px] rounded-large border-2 text-body-lg font-bold
                                    ${feel === k ? 'border-on-surface bg-on-surface text-surface' : 'border-outline text-on-surface'}`}
                        onClick={() => pickFeel(k)}>{l}</button>
              ))}
            </div>
          </div>
        )}

        <Link href={doneHref ?? back?.href ?? '/'} className="btn-primary btn-big pressable mt-7 w-full">
          {!doneHref && back?.label ? `Back to ${back.label}` : 'Done'}
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-pop">
      {back && <BackLink href={back.href} label={back.label} />}
      <h1 className="h-page">{title}</h1>
      {/* The trainer once, here, with what they said about it; not on every drill. */}
      {face ? (
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={trainer!.name} src={trainer!.photo} className="h-10 w-10 text-body-lg" />
          <p className="min-w-0 leading-snug">
            <span className="block text-title-sm font-bold text-on-surface">
              {note ? trainer!.name ?? 'Your trainer' : `From ${who}`}
            </span>
            {note && <span className="block text-title-sm font-medium text-on-surface-variant">&ldquo;{note}&rdquo;</span>}
          </p>
        </div>
      ) : note && <p className="mt-2 text-title-sm font-medium leading-snug text-on-surface-variant">{note}</p>}

      {/* Speed works out "this week" on the phone; until it has, nothing. */}
      {checked && (review ? (
        // Done already: when, and the one thing to do about it.
        <div className="mt-5 brand-card px-5 py-5 shadow-level2">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full accent-badge">
              <Tick className="h-7 w-7" />
            </span>
            <p className="font-brand text-display font-extrabold leading-tight tracking-brand-snug">
              Completed
              <span className="block text-title-sm font-semibold tracking-normal text-on-surface-brand-variant">{DAYS[doneDay!]}</span>
            </p>
          </div>
          <button type="button" onClick={again}
                  className="btn-primary btn-on-brand btn-big pressable mt-5 w-full">
            Do it again
          </button>
        </div>
      ) : (
        // How far through: one number and a bar. It stays in view while the
        // list scrolls under it, so "how much is left" is never a scroll away.
        <div className="sticky top-[calc(env(safe-area-inset-top)+8px)] z-10 mt-5 brand-card px-5 py-4 shadow-level2">
          <div className="flex items-baseline justify-between text-on-surface-brand">
            <span className="font-brand text-display-sm font-extrabold leading-none tracking-brand-snug">
              {done.size} of {drills.length}
            </span>
            <span className="text-body font-bold text-on-surface-brand-variant">{allDone ? 'All done!' : 'done'}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-track">
            <div className="h-full rounded-full bg-brand-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}

      {checked && (
        <ol className="stagger mt-4 space-y-3">
          {drills.map((d) => {
            const on = review || done.has(d.id);
            // Ticked in this run: faded back. Done last time: shown at full strength.
            const dim = on && !review;
            const open = howOpen === d.id;
            const steps = !!d.how?.length;
            // A YouTube video plays here, in the session. Any other link still
            // opens on its own: there's no player to put it in.
            const yt = youtubeId(d.video_url);
            const more = steps || !!yt;
            const away = !!d.video_url && !yt;
            // Ticked in this run, a drill is done with: it doesn't open.
            const opens = more && !dim;
            const body = (
              <>
                <span className="block text-title font-bold leading-snug text-on-surface">{d.name}</span>
                <span className="mt-1 block text-title-sm font-semibold text-on-surface-variant">
                  {/* "rest 1 min", but just "walk back": a rest that's an
                      instruction rather than a time doesn't take "rest". */}
                  {d.amount ?? `${d.sets} × ${d.reps_time}${d.rest && d.rest !== '-'
                    ? (/^\d/.test(d.rest) ? ` · rest ${d.rest}` : ` · ${d.rest}`) : ''}`}
                  {d.effort && ` · ${EFFORT[d.effort].label}`}
                </span>
                {/* The one thing to think about at speed. */}
                {d.cue && <span className="mt-1.5 block text-body-lg font-semibold leading-snug text-on-surface">&ldquo;{d.cue}&rdquo;</span>}
              </>
            );
            return (
              <li key={d.id} ref={(el) => { if (el) rows.current.set(d.id, el); else rows.current.delete(d.id); }}
                  className={`card scroll-mt-[calc(env(safe-area-inset-top)+112px)] overflow-hidden ${opens ? 'card-press' : ''}`}>
                <div className="flex items-center gap-1.5 p-3">
                  <Circle on={on} here={d.id === current} locked={review} name={d.name} onTick={() => toggle(d.id)} />
                  {/* Two parts, one job each: the circle ticks, the drill opens.
                      A chevron marks a drill with steps or a video behind it;
                      one with nothing is just its name and amount, and doesn't
                      pretend to be a button. Hover, press and focus show on the
                      whole card (card-press), not as a box inside it. */}
                  {opens ? (
                    <button type="button" aria-expanded={open} onClick={() => setHowOpen(open ? null : d.id)}
                            className="card-hit flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-1.5 pr-1 text-left">
                      <span className="min-w-0 flex-1">{body}</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true"
                           className={`h-6 w-6 shrink-0 text-on-surface-variant transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                           fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  ) : (
                    <div className={`min-w-0 flex-1 py-2 pl-1.5 pr-2 transition-opacity ${dim ? 'opacity-50' : ''}`}>{body}</div>
                  )}
                </div>

                {/* A link that can't play here, and nothing else to show. */}
                {away && !more && !dim && (
                  <div className="border-t border-outline-variant">
                    <Watch href={d.video_url!} className="pressable flex min-h-12 w-full items-center gap-2 px-4 text-body-lg font-bold text-on-surface" />
                  </div>
                )}

                {/* How to do it, inside the drill: a video across the card,
                    then the steps under the drill's name. No header and no
                    second way to tick; the circle is the tick. */}
                {open && opens && (
                  <div className="hint-in pb-4">
                    {yt && <div className="px-4"><Video id={yt} upright={isYoutubeShort(d.video_url)} title={d.name} href={d.video_url!} /></div>}
                    <div className="pl-[76px] pr-4">
                      {steps && (
                        <ol className="space-y-2.5">
                          {d.how!.map((step, n) => (
                            <li key={n} className="flex gap-2.5 text-title leading-snug text-on-surface">
                              <span className="w-4 shrink-0 font-extrabold text-primary">{n + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {d.effort && (
                        <p className="mt-3 text-body-lg text-on-surface-variant">
                          <span className="font-bold text-on-surface">{EFFORT[d.effort].label}:</span>{' '}
                          {EFFORT[d.effort].means}
                        </p>
                      )}
                      {away && <Watch href={d.video_url!} className="btn-ghost pressable mt-4 gap-2" />}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* The way out is where the list ends, which is where the last tick was. */}
      {!review && allDone && (
        <button ref={finishRef} onClick={finish} className="btn-primary btn-big pressable animate-pop mt-6 w-full">
          Finish
        </button>
      )}
      {!review && !allDone && done.size > 0 && phase === 'running' && (
        <button onClick={() => setPhase('confirm-end')}
                className="btn-ghost pressable mt-6 min-h-13 w-full text-body-lg font-bold">
          Stop early
        </button>
      )}
      {!review && !allDone && done.size > 0 && phase === 'confirm-end' && (
        <div className="hint-in card mt-6 p-5">
          <p className="h-sec">Stop now?</p>
          <div className="mt-4 flex gap-2.5">
            <button onClick={() => setPhase('running')} className="btn-ghost pressable min-h-13 flex-1 font-bold">
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

/**
 * The drill's own tick button, 52px to tap, around the shared tick mark: the
 * next one to do breathes, and a tap fills it and draws the tick in. On a
 * session already done it's only a mark.
 */
function Circle({ on, here, locked, name, onTick }: {
  on: boolean; here: boolean; locked: boolean; name: string; onTick: () => void;
}) {
  const mark = <TickMark on={on} here={here} draw={!locked} />;
  if (locked) return <span className="flex size-13 shrink-0 items-center justify-center">{mark}</span>;
  return (
    <button type="button" aria-pressed={on} aria-label={`Mark ${name} done`} onClick={onTick}
            className="pressable flex size-13 shrink-0 items-center justify-center rounded-full">
      {mark}
    </button>
  );
}

/**
 * A YouTube video, played in the session rather than on YouTube: no leaving
 * mid-session, and no recommendations queued up after it. The privacy-
 * enhanced host, since the players are children. Shorts were filmed upright
 * and get an upright frame. Some videos can't be embedded, so the way out to
 * YouTube stays underneath, small.
 */
function Video({ id, upright, title, href }: { id: string; upright: boolean; title: string; href: string }) {
  return (
    <div className="mb-4">
      <div className={`overflow-hidden rounded-medium bg-black ${upright ? 'mx-auto max-w-full' : 'w-full'}`}
           style={upright ? { aspectRatio: '9 / 16', height: 'min(64dvh, 520px)' } : { aspectRatio: '16 / 9' }}>
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`}
                title={`${title}: video`} loading="lazy" className="h-full w-full"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      <a href={href} target="_blank" rel="noopener"
         className="mt-2 block text-center text-body-sm font-semibold text-on-surface-variant underline underline-offset-4">
        Not playing? Open it on YouTube
      </a>
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
