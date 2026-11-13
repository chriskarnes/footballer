'use client';
import { useEffect, useState, useTransition } from 'react';
import { useToast } from '@/components/coach/Toast';
import { useRouter } from 'next/navigation';
import { saveSoccerDays } from '@/app/schedule-actions';
import type { TeamDays } from '@/lib/academy-week';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Kind = 'off' | 'trainer' | 'practice' | 'game';
/** The order a tap goes in. */
const KINDS: Kind[] = ['off', 'trainer', 'practice', 'game'];
const NAME: Record<Kind, string> = { off: 'Off', trainer: 'Trainer', practice: 'Practice', game: 'Game' };

const toWeek = (d: TeamDays | null): Kind[] => DAYS.map((_, i) =>
  !d ? 'off' : d.games.includes(i) ? 'game' : d.trainer.includes(i) ? 'trainer' : d.practice.includes(i) ? 'practice' : 'off');
const on = (w: Kind[], k: Kind) => w.flatMap((x, i) => (x === k ? [i] : []));
const fromWeek = (w: Kind[]): TeamDays => ({ trainer: on(w, 'trainer'), practice: on(w, 'practice'), games: on(w, 'game') });

/** A ball, for a game. */
function Ball({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.6l4.2 3-1.6 4.9H9.4L7.8 10.6z" fill="currentColor" />
      <path d="M12 7.6V2.6M16.2 10.6l4.6-1.6M14.6 15.5l2.9 4.1M9.4 15.5l-2.9 4.1M7.8 10.6L3.2 9" />
    </svg>
  );
}

/** A whistle, for a day with their trainer. */
function Whistle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <circle cx="9" cy="14.5" r="6" />
      <path d="M9 8.5h12.5v4h-7" />
      <circle cx="9" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A cone, for team practice. */
function Cone({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3.5 17.5 19h-11z" />
      <path d="M8.6 13h6.8M3.5 20.5h17" />
    </svg>
  );
}

const MARK: Record<Kind, (p: { className: string }) => React.ReactNode> = {
  off: () => null, trainer: Whistle, practice: Cone, game: Ball,
};
/** Each kind apart without colour: a thin line, a thick line, grey, filled. */
const LOOK: Record<Kind, string> = {
  off: 'border border-outline-variant text-on-surface-variant',
  trainer: 'border-2 border-on-surface text-on-surface',
  practice: 'border border-transparent bg-surface-container-high text-on-surface',
  game: 'border border-transparent bg-primary text-on-primary',
};

/**
 * A player's soccer week, as seven days to tap. Each tap moves a day on:
 * off, then a day with their trainer, then team practice, then a game, then
 * off again. Any number of each, games too: a tournament weekend is two.
 * The trainer's at-home sessions go on the off days.
 *
 * It's the week itself, not a form for it: what's saved is what's shown, and
 * Save (with Cancel) appears only once a day has changed. With nothing saved
 * yet (`days` null) Save is there from the start, since "no soccer" is an
 * answer too.
 *
 * This was two questions for a while (which days the team practices, then
 * which one day is the game). One game a week didn't fit the kids who play
 * two, and tapping a day until it says what's on was quicker.
 *
 * `userId` saves for one of a trainer's players instead of the viewer.
 */
export function SoccerDays({ days, userId }: { days: TeamDays | null; userId?: string }) {
  const [saved, setSaved] = useState<Kind[]>(() => toWeek(days));
  const [week, setWeek] = useState<Kind[]>(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  // Only the trainer area has a toast; for a player this does nothing.
  const toast = useToast();

  // A fresh answer from the server (another device, the trainer) replaces both.
  const key = days ? `${days.trainer}|${days.practice}|${days.games}` : 'unset';
  useEffect(() => { const w = toWeek(days); setSaved(w); setWeek(w); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = week.some((k, i) => k !== saved[i]);
  const asking = !days;

  const tap = (i: number) => {
    setError(null);
    setWeek((w) => w.map((k, j) => (j === i ? KINDS[(KINDS.indexOf(k) + 1) % KINDS.length] : k)));
  };

  const save = () => start(async () => {
    setError(null);
    const r = await saveSoccerDays({ ...fromWeek(week), userId });
    if (!r.ok) { setError(r.error); return; }
    setSaved(week);
    toast('Saved.');
    router.refresh();
  });

  return (
    <div>
      <p className="text-body font-medium text-on-surface-variant">Tap a day to change it.</p>
      <div className="mt-2.5 grid grid-cols-7 gap-1.5" role="group" aria-label="Soccer week">
        {DAYS.map((label, i) => {
          const k = week[i];
          const Mark = MARK[k];
          return (
            <button key={label} type="button" onClick={() => tap(i)} disabled={pending}
                    aria-label={`${FULL[i]}: ${NAME[k]}`}
                    className={`pressable flex min-h-14 flex-col items-center justify-center gap-1 rounded-medium text-body font-bold transition-colors ${LOOK[k]}`}>
              {label}
              <span className="flex size-4.5 items-center justify-center">
                <Mark className="size-4.5" />
                {k === 'off' && <span className="h-1 w-1 rounded-full bg-outline" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* The four, in the order a tap goes through them. */}
      <ol className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-body font-semibold text-on-surface-variant" aria-label="Each tap goes to the next">
        {KINDS.map((k) => {
          const Mark = MARK[k];
          return (
            <li key={k} className="flex items-center gap-1">
              <span className={`flex h-5 w-5 items-center justify-center rounded-small ${LOOK[k]}`} aria-hidden="true">
                <Mark className="h-3.5 w-3.5" />
              </span>
              {NAME[k]}
            </li>
          );
        })}
      </ol>

      {error && <p role="alert" className="mt-3 text-body font-semibold text-on-surface">{error}</p>}
      {changed || asking ? (
        <div className="mt-4 flex items-center gap-2.5">
          <button type="button" onClick={save} disabled={pending} className="btn-primary btn-sm pressable">
            {pending ? 'Saving…' : 'Save'}
          </button>
          {changed && !asking && (
            <button type="button" onClick={() => { setWeek(saved); setError(null); }} disabled={pending}
                    className="btn-ghost btn-sm pressable">Cancel</button>
          )}
        </div>
      ) : !userId && (
        <p className="mt-3 text-body-lg font-medium leading-snug text-on-surface">Your sessions go on the off days.</p>
      )}
    </div>
  );
}

/**
 * The same, in a card, for the player's own pages. Unanswered, it asks first.
 */
export function SoccerDaysPanel({ days }: { days: TeamDays | null }) {
  return (
    <div className="card p-4">
      {!days && <p className="mb-2 text-title-sm font-bold leading-snug text-on-surface">When do you have soccer?</p>}
      <SoccerDays days={days} />
    </div>
  );
}
