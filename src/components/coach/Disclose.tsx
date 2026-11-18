'use client';
import { useId, useState } from 'react';

/**
 * A quiet button that opens what's under it: settings, or a tick-list, that
 * most visits to the page don't need. It keeps its own state, so the page
 * refreshing underneath (a player ticked in) doesn't snap it shut.
 *
 * `wideOpen`: folded on a phone only. From xl up, where the page has a
 * second column and the room, there's no button and what's under it is
 * simply there.
 */
export function Disclose({ label, startOpen = false, wideOpen = false, children }: {
  label: string; startOpen?: boolean; wideOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  const id = useId();
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
              className={`btn-ghost btn-sm pressable gap-1.5 pr-3 ${wideOpen ? 'xl:hidden' : ''}`}>
        {label}
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
             className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {wideOpen
        // Hidden by class, not the attribute, so the wide screen can show it.
        ? <div id={id} className={`mt-3 xl:mt-0 ${open ? '' : 'hidden xl:block'}`}>{children}</div>
        : <div id={id} hidden={!open} className="mt-3">{children}</div>}
    </div>
  );
}
