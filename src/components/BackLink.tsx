import Link from 'next/link';

/**
 * The one back control, shared by every screen you can reach from somewhere.
 *
 * It is a 44px pill with its own outline rather than a line of text behind a
 * chevron: this is the only way out of a page that covers the whole screen, so
 * it has to be reliably hittable with a thumb, not merely findable.
 *
 * `label` names the destination, not the action — "Ball Mastery" tells you where
 * you land, where "Back" only tells you that you leave.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={`Back to ${label}`}
      className="pressable mb-6 inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full
                 border border-outline pl-3 pr-4 text-[13px] font-bold text-on-surface-variant
                 hover:text-on-surface">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor"
           strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      <span className="truncate">{label}</span>
    </Link>
  );
}
