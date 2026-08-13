'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTouches } from '@/lib/session-builder';
import type { Program, SessionRow } from '@/lib/types';

/**
 * Program rows, and the modal bottom sheet they open.
 *
 * A program used to be a route change: no way back, and the tab bar stayed live
 * underneath, so a mis-tap dropped you into Plan and lost your place in a
 * 786-item list. The sheet covers the navigation bar and the scrim swallows taps
 * meant for it — the accidental navigation is not styled away, it is made
 * impossible.
 *
 * Built on native <dialog>.showModal() rather than the harness's hand-rolled
 * div, as the migration brief asks. That buys the focus trap, Esc, the top
 * layer and inert-behind for free and correctly; the harness only faked them
 * because showModal() escapes a 393px phone mock.
 */
export function ProgramSheet({
  programs, sessions,
}: { programs: Program[]; sessions: SessionRow[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Where focus goes back to on close. Losing this is the difference between
  // "I closed the sheet" and "I am now at the top of the page again".
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState<Program | null>(null);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // <dialog> fires `close` for every exit route — button, Esc, form method=dialog
  // — so returning focus once here covers all of them rather than three times.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onClose = () => {
      setOpen(null);
      openerRef.current?.focus();
      openerRef.current = null;
    };
    el.addEventListener('close', onClose);
    return () => el.removeEventListener('close', onClose);
  }, []);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      closeRef.current?.focus();
    }
  }, [open]);

  const mine = open
    ? sessions.filter((s) => s.program_id === open.id).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5">
        {programs.map((p) => {
          const n = sessions.filter((s) => s.program_id === p.id).length;
          return (
            <button key={p.id} type="button"
              onClick={(e) => { openerRef.current = e.currentTarget; setOpen(p); }}
              className="card pressable flex w-full items-center gap-4 p-4 text-left">
              <div className="min-w-0 flex-1">
                <div className="h-card truncate">{p.name}</div>
                {/* No minute total. The number that helps is per drill, on Train —
                    "384m" against a program is a figure nobody acts on. */}
                <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
                  {p.level} · {n} sessions · {formatTouches(p.touches)} touches
                </div>
              </div>
              <svg viewBox="0 0 24 24" aria-hidden="true"
                   className="h-4 w-4 shrink-0 text-on-surface-variant" fill="none"
                   stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* The scrim is ::backdrop — see globals.css. Clicking it closes, because
          the dialog element itself is the only thing that isn't the backdrop. */}
      <dialog ref={dialogRef} className="sheet-dialog"
        aria-label={open ? `${open.name} sessions` : undefined}
        onClick={(e) => { if (e.target === dialogRef.current) close(); }}>
        {open && (
          <div className="sheet-inner">
            <div className="sheet-handle" />
            <div className="sheet-head">
              <div className="min-w-0 flex-1">
                <h2 className="h-card truncate">{open.name}</h2>
                <p className="mt-0.5 text-[12.5px] text-on-surface-variant">
                  {open.level} · {mine.length} sessions · {formatTouches(open.touches)} touches
                </p>
              </div>
              <button ref={closeRef} type="button" onClick={close}
                className="icon-btn pressable" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                     strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="sheet-body">
              {!!open.goal && (
                <p className="mb-4 text-[14px] leading-relaxed text-on-surface-variant">{open.goal}</p>
              )}
              <ol className="grid grid-cols-1 gap-2.5">
                {mine.map((s, i) => (
                  <li key={s.id}>
                    <Link href={`/session/${s.id}`} onClick={close}
                      className="card-flat pressable flex items-center gap-4 p-4">
                      <span className="font-brand text-[13px] font-bold text-on-surface-variant">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="h-card truncate">{s.name}</div>
                        <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
                          {Math.round(s.total_minutes)} min
                          {!!s.touches && ` · ${formatTouches(s.touches)} touches`}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
