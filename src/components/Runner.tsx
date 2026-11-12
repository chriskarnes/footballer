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

type Phase = 'running' | 'confirm-end' | 'finished';
/** What became of the finished session. `signin` means it's waiting in this
 *  browser for an account — see pending.ts. */
type Save = 'saving' | 'saved' | 'signin' | 'error';
type Trainer = { name: string | null; photo: string | null };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

/** Whether a drill has anything behind "Show me how": steps, or a video that plays here. */
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
  /** Done already this week: the weekday it was finished (Monday 0), from the
   *  same week Train reads. It opens as done, with Do it again. */
  completedDay?: number | null;
  /** The same for Speed: when it was finished lately. Whether that's this week
   *  is the player's own week, so it's worked out here, once on the phone. */
  completedAt?: string[];
  /** The trainer, when the drills are theirs and a player is looking: their
   *  face on Show me how, and their name on the finish. */
  trainer?: Trainer;
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('running');
  const [save, setSave] = useState<Save>('saving');
  const [played, setPlayed] = useState(0);
  // A trainer's session asks how it felt: that's what steps the next week up.
  const [savedId, setSavedId] = useState<string | null>(workoutId ?? null);
  const [feel, setFeel] = useState<'easy' | 'right' | 'hard' | null>(null);
  const asksFeel = source === 'academy' || source === 'addon';
  // Done already this week: shown done, every drill ticked and nothing to
  // change, until they choose to go again. A redo is a new session of its
  // own: it counts for This week and their trainer sees it, and the week's
  // tick stays where it was.
  const [doneDay, setDoneDay] = useState<number | null>(completedDay);
  const [checked, setChecked] = useState(!completedAt?.length);
  const review = doneDay !== null;
  // Which drill's "Show me how" is open. One at a time: the list is the
  // thing being worked through. A run starts with the first one open.
  const [howOpen, setHowOpen] = useState<string | null>(
    () => (completedDay === null && showable(drills[0]) ? drills[0].id : null));
  const openedAt = useRef(Date.now());
  const startedAt = useRef<number | null>(null);
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
    const d = drills.find((x) => x.id === id);
    if (startedAt.current === null && d) {
      startedAt.current = Date.now() - d.total_seconds * rounds * 1000;
    }
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
    openedAt.current = Date.now();
    startedAt.current = null;
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

  // Their trainer, by name where it's known: "Mike will see this".
  const face = !!trainer && (!!trainer.name || !!trainer.photo);
  const who = trainer?.name ?? 'your trainer';

  if (finished) {
    const ask = feel ? 'Thanks!' : trainer ? `Tell ${who} how it was` : 'How was it?';
    return (
      <div className="animate-pop">
        {/* Ended early is still a session: the headline cheers either way, and
            the count underneath carries the difference. */}
        <div className="celebrate mt-4 rounded-large-increased border border-brand-edge bg-surface-brand px-6 py-9 text-center shadow-level3">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }}>
            <Tick className="h-8 w-8" draw />
          </span>
          <h1 className="site-wide mt-5 text-[32px] uppercase leading-none text-on-surface-brand">
            {allDone ? 'Nice work!' : 'Good effort!'}
          </h1>
          <p className="mt-3 text-[17px] font-semibold text-on-surface-brand-variant">
            {done.size} of {drills.length} drills · {played} min
          </p>

          {/* A trainer's session goes to the trainer: say so, while it's on its
              way or there. If it didn't save, the line below says that instead. */}
          {trainer && asksFeel && (save === 'saving' || save === 'saved') && (
            <div className="mt-5 flex items-center justify-center gap-2.5">
              {face && <Avatar name={trainer.name} src={trainer.photo} className="h-9 w-9 text-[14px]" onBrand />}
              <p className="text-[16px] font-bold text-on-surface-brand">
                {trainer.name ?? 'Your trainer'} will see this
              </p>
            </div>
          )}

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
            <h2 className="h-sec text-center">{ask}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2.5" role="group" aria-label={ask}>
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

      {/* Speed works out "this week" on the phone; until it has, nothing. */}
      {checked && (review ? (
        // Done already: when, and the one thing to do about it.
        <div className="mt-5 rounded-2xl border border-brand-edge bg-surface-brand px-5 py-5 text-on-surface-brand shadow-level2">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }}>
              <Tick className="h-7 w-7" />
            </span>
            <p className="font-brand text-[24px] font-extrabold leading-tight tracking-tighter">
              Completed
              <span className="block text-[16px] font-semibold tracking-normal text-on-surface-brand-variant">{DAYS[doneDay!]}</span>
            </p>
          </div>
          <button type="button" onClick={again}
                  className="btn-primary btn-big pressable mt-5 w-full bg-on-surface-brand text-surface-brand">
            Do it again
          </button>
        </div>
      ) : (
        // How far through: one number and a bar. It stays in view while the
        // list scrolls under it, so "how much is left" is never a scroll away.
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
            const body = (
              <>
                <span className="block text-[17px] font-bold leading-snug text-on-surface">{d.name}</span>
                <span className="mt-1 block text-[16px] font-semibold text-on-surface-variant">
                  {/* "rest 1 min", but just "walk back": a rest that's an
                      instruction rather than a time doesn't take "rest". */}
                  {d.amount ?? `${d.sets} × ${d.reps_time}${d.rest && d.rest !== '-'
                    ? (/^\d/.test(d.rest) ? ` · rest ${d.rest}` : ` · ${d.rest}`) : ''}`}
                  {d.effort && ` · ${EFFORT[d.effort].label}`}
                </span>
                {/* The one thing to think about at speed. */}
                {d.cue && <span className="mt-1.5 block text-[15px] font-semibold leading-snug text-on-surface">&ldquo;{d.cue}&rdquo;</span>}
                {more && !dim && <ShowHow open={open} trainer={face ? trainer : undefined} />}
              </>
            );
            return (
              <li key={d.id} ref={(el) => { if (el) rows.current.set(d.id, el); else rows.current.delete(d.id); }}
                  className="card scroll-mt-[calc(env(safe-area-inset-top)+112px)] overflow-hidden">
                <div className="flex items-start gap-1.5 p-3">
                  <Circle on={on} here={d.id === current} locked={review} name={d.name} onTick={() => toggle(d.id)} />
                  {/* The card opens "Show me how"; only the circle ticks. A drill
                      with nothing behind it is just its name and amount, and
                      doesn't pretend to be a button. */}
                  {more ? (
                    <button type="button" aria-expanded={open} onClick={() => setHowOpen(open ? null : d.id)}
                            className={`pressable min-w-0 flex-1 rounded-xl py-2 pl-1.5 pr-2 text-left transition-opacity ${dim ? 'opacity-50' : ''}`}>
                      {body}
                    </button>
                  ) : (
                    <div className={`min-w-0 flex-1 py-2 pl-1.5 pr-2 transition-opacity ${dim ? 'opacity-50' : ''}`}>{body}</div>
                  )}
                </div>

                {/* A link that can't play here, and nothing else to show. */}
                {away && !more && !dim && (
                  <div className="border-t border-outline-variant">
                    <Watch href={d.video_url!} className="pressable flex min-h-12 w-full items-center gap-2 px-4 text-[15px] font-bold text-on-surface" />
                  </div>
                )}

                {/* How to do it: a video, the steps, or both, then "I did it". */}
                {open && more && (
                  <div className="hint-in border-t border-outline-variant px-4 pb-4 pt-4">
                    {trainer?.name && (
                      <p className="mb-3 flex items-center gap-2.5 text-[15px] font-bold text-on-surface">
                        <Avatar name={trainer.name} src={trainer.photo} className="h-8 w-8 text-[13px]" />
                        From {trainer.name}
                      </p>
                    )}
                    {yt && <Video id={yt} upright={isYoutubeShort(d.video_url)} title={d.name} href={d.video_url!} />}
                    {steps && (
                      <ol className="space-y-3">
                        {d.how!.map((step, n) => (
                          <li key={n} className="flex gap-3 text-[17px] leading-snug text-on-surface">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[15px] font-extrabold">{n + 1}</span>
                            <span className="pt-1">{step}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {d.effort && (
                      <p className="mt-3 text-[15px] text-on-surface-variant">
                        <span className="font-bold text-on-surface">{EFFORT[d.effort].label}:</span>{' '}
                        {EFFORT[d.effort].means}
                      </p>
                    )}
                    {away && <Watch href={d.video_url!} className="btn-ghost pressable mt-4 gap-2" />}
                    {/* Words for the kids who don't read the circle as a button. */}
                    {!on && (
                      <button type="button" onClick={() => toggle(d.id)} className="btn-primary btn-big pressable mt-5 w-full">
                        I did it
                      </button>
                    )}
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
                className="btn-ghost pressable mt-6 min-h-[52px] w-full text-[15px] font-bold">
          Stop early
        </button>
      )}
      {!review && !allDone && done.size > 0 && phase === 'confirm-end' && (
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

/** A tick. `draw` draws it in, for the moment something gets done. */
function Tick({ className, draw = false }: { className: string; draw?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor"
         strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path className={draw ? 'celebrate-tick' : undefined} d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * The drill's own tick button, 52px to tap. Not yet done, it's a ring in the
 * academy's colour with a faint tick inside, so it reads as "a tick goes
 * here"; the next one to do breathes. Tapped, it fills and the tick draws in.
 * On a session already done it's only a mark.
 */
function Circle({ on, here, locked, name, onTick }: {
  on: boolean; here: boolean; locked: boolean; name: string; onTick: () => void;
}) {
  const mark = on ? (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary">
      <Tick className="h-5 w-5" draw={!locked} />
    </span>
  ) : (
    <span className={`flex h-11 w-11 items-center justify-center rounded-full border-[2.5px] border-primary text-primary ${here ? 'tick-here' : ''}`}>
      <Tick className="h-5 w-5 opacity-25" />
    </span>
  );
  if (locked) return <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center">{mark}</span>;
  return (
    <button type="button" aria-pressed={on} aria-label={`Mark ${name} done`} onClick={onTick}
            className="pressable flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full">
      {mark}
    </button>
  );
}

/**
 * "Show me how", as a chip in the academy's colour rather than a line of
 * small text, so it's seen. On a trainer's drill it carries their face.
 */
function ShowHow({ open, trainer }: { open: boolean; trainer?: Trainer }) {
  return (
    <span className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[16px] font-bold text-on-surface"
          style={{ background: 'color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent)' }}>
      {trainer && <Avatar name={trainer.name} src={trainer.photo} className="-ml-2 h-7 w-7 text-[12px]" />}
      {open ? 'Hide' : 'Show me how'}
      <svg viewBox="0 0 24 24" aria-hidden="true"
           className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
           fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
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
      <div className={`overflow-hidden rounded-xl bg-black ${upright ? 'mx-auto max-w-full' : 'w-full'}`}
           style={upright ? { aspectRatio: '9 / 16', height: 'min(64dvh, 520px)' } : { aspectRatio: '16 / 9' }}>
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`}
                title={`${title}: video`} loading="lazy" className="h-full w-full"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      <a href={href} target="_blank" rel="noopener"
         className="mt-2 block text-center text-[13px] font-semibold text-on-surface-variant underline underline-offset-4">
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
