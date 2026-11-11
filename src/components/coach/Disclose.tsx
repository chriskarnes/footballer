'use client';
import { useId, useState } from 'react';

/**
 * A quiet button that opens what's under it: settings, or a tick-list, that
 * most visits to the page don't need. It keeps its own state, so the page
 * refreshing underneath (a player ticked in) doesn't snap it shut.
 */
export function Disclose({ label, startOpen = false, children }: {
  label: string; startOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  const id = useId();
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
              className="btn-ghost btn-sm pressable gap-1.5 pr-3">
        {label}
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
             className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div id={id} hidden={!open} className="mt-3">{children}</div>
    </div>
  );
}
