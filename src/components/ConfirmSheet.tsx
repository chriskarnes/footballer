'use client';
import { useEffect, useRef } from 'react';

/**
 * A second tap for an action that changes something you'd notice — making a
 * different plan active, deleting one. A sentence saying what will happen,
 * Cancel, and the action named as itself rather than "OK".
 *
 * Open while `open` is true. Escape, the backdrop and Cancel all call
 * onCancel; nothing closes it silently. See .confirm-sheet in globals.css.
 */
export function ConfirmSheet({
  open, title, body, confirmLabel, busy, onConfirm, onCancel,
}: {
  open: boolean; title: string; body?: React.ReactNode; confirmLabel: string;
  busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm-sheet" aria-labelledby="confirm-sheet-title"
            onCancel={(e) => { e.preventDefault(); onCancel(); }}
            // A tap on the backdrop lands on the dialog itself, outside the card.
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      {open && (
        <div className="sheet-in card p-5 shadow-level3">
          <p id="confirm-sheet-title" className="h-card">{title}</p>
          {body && <div className="mt-1.5 text-body leading-snug text-on-surface-variant">{body}</div>}
          <div className="mt-5 flex gap-2.5">
            <button type="button" onClick={onCancel} className="btn-ghost min-h-[52px] flex-1">Cancel</button>
            <button type="button" onClick={onConfirm} disabled={busy}
                    className="btn-primary pressable flex-1">
              {busy ? 'One moment…' : confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
