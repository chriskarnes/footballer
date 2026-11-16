'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MenuItem = {
  label: string;
  onSelect: () => void;
  /** Something that can't be undone: shown in the warning colour. */
  danger?: boolean;
  disabled?: boolean;
};

/**
 * The three dots: where an admin page keeps what's done rarely, so the page
 * itself can show only what's read or done often. The list is drawn on the
 * body and placed under its button, so a table that scrolls sideways can't
 * clip it.
 */
export function Menu({ label, items, busy }: { label: string; items: MenuItem[]; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    setAt({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !button.current?.contains(t)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); button.current?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const all = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const i = all.indexOf(document.activeElement as HTMLButtonElement);
        all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    // It's placed once: anything that moves the button closes it.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    if (open && at) list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [open, at]);

  if (!items.length) return null;
  return (
    <>
      <button ref={button} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
              disabled={busy} className="icon-btn relative z-10 bg-transparent text-on-surface-variant hover:text-on-surface disabled:opacity-50"
              onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {open && at && createPortal(
        <div ref={list} id={id} role="menu" aria-label={label} style={{ top: at.top, right: at.right }}
             className="fixed z-[70] min-w-48 max-w-[18rem] rounded-2xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-level3">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled}
                    className={`flex min-h-11 w-full items-center rounded-xl px-3.5 text-left text-body font-semibold hover:bg-surface-container-high focus-visible:bg-surface-container-high disabled:opacity-50
                      ${it.danger ? 'text-[#B3261E] dark:text-[#FFB4AB]' : 'text-on-surface'}`}
                    onClick={() => { setOpen(false); it.onSelect(); }}>
              {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
