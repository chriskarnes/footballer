'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSoccerDays } from '@/app/schedule-actions';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Days = { club: number[]; game: number | null };

/** A ball, for the game day. */
function Ball({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.6l4.2 3-1.6 4.9H9.4L7.8 10.6z" fill="currentColor" />
      <path d="M12 7.6V2.6M16.2 10.6l4.6-1.6M14.6 15.5l2.9 4.1M9.4 15.5l-2.9 4.1M7.8 10.6L3.2 9" />
    </svg>
  );
}

/**
 * A player's team days, as two plain questions: which days the team
 * practices (any number), then which day is the game (one, or none). It used
 * to be one row where a tap went free → training → game, which a ten-year-old
 * had to be told and then remember, and it called practice "Train", the name
 * of the tab their own sessions are on. The trainer's sessions go on the
 * days left over.
 *
 * `userId` saves for one of a trainer's players instead of the viewer, and
 * asks in the trainer's words.
 */
export function SoccerDays({ club = [], game = null, userId, onDone, onCancel, cta = 'Save' }: {
  club?: number[]; game?: number | null; userId?: string;
  onDone?: (saved: Days) => void; onCancel?: () => void; cta?: string;
}) {
  const [practice, setPractice] = useState<number[]>(club.filter((d) => d !== game));
  const [match, setMatch] = useState<number | null>(game);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // A day is practice or the game, not both: picking one takes it from the other.
  const tapPractice = (i: number) => {
    setPractice((p) => (p.includes(i) ? p.filter((d) => d !== i) : [...p, i].sort()));
    if (match === i) setMatch(null);
  };
  const tapGame = (i: number | null) => {
    setMatch((m) => (m === i ? null : i));
    if (i !== null) setPractice((p) => p.filter((d) => d !== i));
  };

  const save = () => start(async () => {
    setError(null);
    const r = await saveSoccerDays({ club: practice, game: match, userId });
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
    onDone?.({ club: practice, game: match });
  });

  const q = userId
    ? { practice: 'Practice days', game: 'Game day' }
    : { practice: 'Which days does your team practice?', game: 'Which day is your game?' };
  const day = 'pressable flex min-h-[52px] items-center justify-center rounded-xl border text-[14px] font-bold transition-colors';

  return (
    <div>
      <p className="text-[16px] font-bold leading-snug text-on-surface">{q.practice}</p>
      <p className="mt-0.5 text-[14px] font-medium text-on-surface-variant">Tap all of them.</p>
      <div className="mt-3 grid grid-cols-7 gap-1.5" role="group" aria-label="Practice days">
        {DAYS.map((label, i) => {
          const on = practice.includes(i);
          return (
            <button key={label} type="button" onClick={() => tapPractice(i)} aria-pressed={on}
                    className={`${day} ${on ? 'border-on-surface bg-on-surface text-surface' : 'border-outline text-on-surface'}`}>
              {label}
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-[16px] font-bold leading-snug text-on-surface">{q.game}</p>
      <div role="radiogroup" aria-label="Game day">
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {DAYS.map((label, i) => {
          const on = match === i;
          return (
            <button key={label} type="button" role="radio" aria-checked={on} onClick={() => tapGame(i)}
                    className={`${day} flex-col gap-0.5 ${on ? 'border-primary bg-primary text-on-primary' : 'border-outline text-on-surface'}`}>
              {label}
              {on && <Ball className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
      <button type="button" role="radio" aria-checked={match === null} onClick={() => tapGame(null)}
              className={`pressable mt-2 min-h-11 rounded-full border px-4 text-[14px] font-bold transition-colors
                          ${match === null ? 'border-on-surface bg-on-surface text-surface' : 'border-outline text-on-surface'}`}>
        No game
      </button>
      </div>

      {error && <p role="alert" className="mt-3 text-[14px] font-semibold text-on-surface">{error}</p>}
      <div className="mt-6 flex items-center gap-2.5">
        <button type="button" onClick={save} disabled={pending} className="btn-primary btn-sm pressable">
          {pending ? 'Saving…' : cta}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={pending} className="btn-ghost btn-sm pressable">Cancel</button>
        )}
      </div>
    </div>
  );
}

/**
 * Their team days as the week itself: seven days, practice filled in, the
 * game day in the academy's colour with a ball, the free days left plain,
 * because the free days are where their training goes. Change opens the two
 * questions. With nothing set, the questions are open to start with.
 */
export function SoccerDaysPanel({ club, game, set }: { club: number[]; game: number | null; set: boolean }) {
  const [open, setOpen] = useState(!set);
  // What was just saved, shown straight away rather than after the refresh.
  const [shown, setShown] = useState<Days>({ club, game });
  const key = `${club.join()}|${game}`;
  useEffect(() => { setShown({ club, game }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (open) {
    return (
      <div className="card p-5">
        <SoccerDays club={shown.club} game={shown.game}
                    onDone={(saved) => { setShown(saved); setOpen(false); }}
                    onCancel={set ? () => setOpen(false) : undefined} />
      </div>
    );
  }
  return (
    <div className="card p-4">
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Your team's week">
        {DAYS.map((label, i) => {
          const isGame = shown.game === i;
          const isPractice = !isGame && shown.club.includes(i);
          return (
            <li key={label} aria-label={`${label}: ${isGame ? 'game' : isPractice ? 'practice' : 'free'}`}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl text-[14px] font-bold
                            ${isGame ? 'bg-primary text-on-primary'
                              : isPractice ? 'bg-surface-container-high text-on-surface'
                              : 'border border-outline-variant text-on-surface-variant'}`}>
              {label}
              {isGame && <Ball className="h-4 w-4" />}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] font-semibold text-on-surface-variant">
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-surface-container-high ring-1 ring-outline-variant" aria-hidden="true" />Practice</span>
        <span className="flex items-center gap-1.5"><Ball className="h-4 w-4 text-primary" />Game</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 text-[15px] font-medium leading-snug text-on-surface">Your training goes on the other days.</p>
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn-sm pressable shrink-0">Change</button>
      </div>
    </div>
  );
}
