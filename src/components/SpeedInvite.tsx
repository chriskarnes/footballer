'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { autoStart } from '@/lib/speed-year';
import { useYearStart } from '@/lib/use-year-start';
import { haptic } from '@/lib/haptics';

const WATCH = 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2.5M10 2h4M19 5l1.5 1.5';
const Icon = ({ d, className }: { d: string; className: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

/**
 * Speed, offered as what it is: a program of its own that has to be started,
 * not the next thing their trainer set. It had been a big "Get faster" button
 * in Start's place, the same size and colour, saying neither.
 *
 * Not started: an outlined button that opens a sheet saying what the program
 * is, with Start and Not now, so nothing starts by surprise. Started: the same
 * button goes straight to Speed. `onBrand` is for Train's band.
 */
export function SpeedInvite({ trainer, onBrand = false, className = '' }: {
  trainer: string | null; onBrand?: boolean; className?: string;
}) {
  const { start, ready, save } = useYearStart();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Outlined in its own ink (.btn-outline): white or black on the band,
  // whichever the band's colour takes, never a see-through white that turns
  // pink on a red band or brown on a yellow one.
  const look = `btn-outline flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full text-title font-bold ${
    onBrand ? 'text-on-surface-brand' : 'text-on-surface'} ${className}`;
  const inner = <><Icon d={WATCH} className="h-5 w-5" />{start ? 'My speed program' : 'Try the speed program'}</>;

  // Until the stored start is read, hold the button's place: it could be
  // either one.
  if (!ready) return <span aria-hidden className={`${look} invisible`}>{inner}</span>;
  if (start) return <Link href="/speed" className={look}>{inner}</Link>;

  const begin = () => {
    haptic('success');
    save(autoStart(new Date()));
    setOpen(false);
    router.push('/speed');
  };

  return (
    <>
      <button type="button" className={look} onClick={() => { haptic('tap'); setOpen(true); }}>{inner}</button>
      <dialog ref={ref} className="confirm-sheet" aria-labelledby="speed-invite-title"
              onCancel={(e) => { e.preventDefault(); setOpen(false); }}
              // A tap on the backdrop lands on the dialog itself, outside the card.
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        {open && (
          <div className="sheet-in card p-5 shadow-level3">
            <span className="flex h-12 w-12 items-center justify-center rounded-large bg-surface-container-high text-on-surface">
              <Icon d={WATCH} className="h-7 w-7" />
            </span>
            <h2 id="speed-invite-title" className="mt-4 text-display font-extrabold leading-tight tracking-tight text-on-surface">
              Speed is its own program
            </h2>
            <p className="mt-1.5 text-title-sm leading-snug text-on-surface-variant">
              It&rsquo;s extra, on top of {trainer ? `${trainer}’s` : 'your trainer’s'} sessions, not instead of them.
            </p>
            <ul className="mt-4 space-y-2.5 text-title-sm leading-snug text-on-surface">
              <li className="flex gap-3"><Icon d="M4 5h16v16H4zM16 3v4M8 3v4M4 11h16" className="mt-px h-5 w-5 shrink-0" />A year long, up to five sessions a week</li>
              <li className="flex gap-3"><Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2" className="mt-px h-5 w-5 shrink-0" />Most are 20 to 45 minutes</li>
              <li className="flex gap-3"><Icon d="M5 21V4M5 4h11l-2 4 2 4H5" className="mt-px h-5 w-5 shrink-0" />A test day every four weeks, to see your times drop</li>
            </ul>
            <button type="button" onClick={begin} className="btn-primary btn-big pressable mt-5 w-full">
              Start my speed program
            </button>
            <button type="button" onClick={() => setOpen(false)}
                    className="pressable mt-1.5 min-h-12 w-full rounded-full text-title-sm font-bold text-on-surface-variant">
              Not now
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
