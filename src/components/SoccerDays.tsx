'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSoccerDays } from '@/app/schedule-actions';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Day = 'free' | 'club' | 'game';

/**
 * "Which days do you already have soccer?" Seven buttons; a tap goes free →
 * club → game → free. One game day at most: picking a new one frees the old.
 * The trainer's sessions then go on the free days.
 *
 * `userId` saves for one of a trainer's players instead of the viewer.
 */
export function SoccerDays({ club = [], game = null, userId, onDone, cta = 'Save' }: {
  club?: number[]; game?: number | null; userId?: string; onDone?: () => void; cta?: string;
}) {
  const [days, setDays] = useState<Day[]>(DAYS.map((_, i) => (i === game ? 'game' : club.includes(i) ? 'club' : 'free')));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const tap = (i: number) => setDays((ds) => ds.map((d, j) => {
    if (j !== i) return ds[i] === 'club' && d === 'game' ? 'free' : d;
    return d === 'free' ? 'club' : d === 'club' ? 'game' : 'free';
  }));

  const save = () => start(async () => {
    setError(null);
    const r = await saveSoccerDays({
      club: days.flatMap((d, i) => (d === 'club' ? [i] : [])),
      game: days.indexOf('game') >= 0 ? days.indexOf('game') : null,
      userId,
    });
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
    onDone?.();
  });

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Your soccer days">
        {DAYS.map((label, i) => {
          const d = days[i];
          return (
            <button key={label} type="button" onClick={() => tap(i)} aria-pressed={d !== 'free'}
                    aria-label={`${label}: ${d === 'free' ? 'free' : d === 'club' ? 'club training' : 'game'}`}
                    className={`pressable flex min-h-[56px] flex-col items-center justify-center rounded-xl border text-[13px] font-bold transition-colors
                      ${d === 'free' ? 'border-outline text-on-surface'
                        : d === 'club' ? 'border-on-surface bg-on-surface text-surface'
                        : 'border-on-surface bg-surface text-on-surface ring-2 ring-inset ring-on-surface'}`}>
              {label}
              <span className={`mt-0.5 text-[10.5px] font-semibold ${d === 'free' ? 'text-on-surface-variant' : ''}`}>
                {d === 'free' ? '·' : d === 'club' ? 'Team' : 'Game'}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-[14px] font-medium text-on-surface-variant">Tap once for team practice. Tap twice for a game.</p>
      {error && <p role="alert" className="mt-2 text-[13px] font-semibold text-on-surface">{error}</p>}
      <button type="button" onClick={save} disabled={pending} className="btn-primary btn-sm pressable mt-4">
        {pending ? 'Saving…' : cta}
      </button>
    </div>
  );
}

/**
 * Their soccer days in a line, with Change to open the picker. With nothing
 * set, the picker is open, with a line on why it's worth a tap.
 */
export function SoccerDaysPanel({ club, game, set }: { club: number[]; game: number | null; set: boolean }) {
  const [open, setOpen] = useState(!set);
  if (!open) {
    return (
      <div className="card p-4">
        {/* The week as it is: practice days filled, game day ringed, the rest quiet. */}
        <ol className="grid grid-cols-7 gap-1.5" aria-label="My team's week">
          {DAYS.map((d, i) => {
            const kind = i === game ? 'Game' : club.includes(i) ? 'Practice' : null;
            return (
              <li key={d} aria-label={`${d}: ${kind ?? 'free'}`}
                  className={`flex min-h-[58px] flex-col items-center justify-center rounded-xl text-[13px] font-bold
                    ${kind === 'Game' ? 'bg-surface-brand text-on-surface-brand'
                      : kind ? 'bg-on-surface text-surface' : 'bg-surface-container-low text-on-surface-variant'}`}>
                {d}
                <span className="mt-0.5 text-[10px] font-bold">{kind === 'Practice' ? 'Team' : kind ?? '·'}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <p className="text-[14px] font-semibold text-on-surface-variant">
            {game === null && !club.length ? 'No team days yet.' : 'Your sessions go on the other days.'}
          </p>
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn-sm pressable shrink-0">Change</button>
        </div>
      </div>
    );
  }
  return (
    <div className="card p-5">
      <div className="h-sec">Which days is your team on?</div>
      <div className="mt-4">
        <SoccerDays club={club} game={game} onDone={() => setOpen(false)} cta="Save" />
      </div>
    </div>
  );
}
