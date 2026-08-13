'use client';

/**
 * The filter chip, with the checkmark the design system has always specified.
 *
 * Selection is carried by three things at once, and it needs all three: the
 * secondary-container fill, the border in the label's own ink, and this mark.
 * Fill alone is a 1.1:1 boundary against the page, and colour alone is not
 * available to everyone — the mark is what makes selected/unselected legible
 * without seeing a hue difference at all.
 *
 * A component rather than markup at each call site because the SVG is 200
 * characters and there are forty chips across Train, Plan and Me.
 */
export function CheckIcon({ className = 'chip-check' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none"
         stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function Chip({
  on, onClick, children, label,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Accessible name, when the visible label reads oddly out of context. */
  label?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label}
            className={`chip pressable ${on ? 'chip-on' : ''}`}>
      <CheckIcon />
      {children}
    </button>
  );
}
