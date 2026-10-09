import Link from 'next/link';

/**
 * The one back control, shared by every screen you can reach from somewhere.
 *
 * It is a ghost button with a chevron rather than a line of text behind one:
 * this is the only way out of a page that covers the whole screen, so it has
 * to be reliably hittable with a thumb, not merely findable. btn-ghost rather
 * than its own pill, because it had become a third 44px outlined pill that
 * agreed with neither the chip nor the button it sat between.
 *
 * `label` names the destination, not the action — "Ball Mastery" tells you where
 * you land, where "Back" only tells you that you leave.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={`Back to ${label}`}
      className="btn-ghost pressable mb-6 max-w-full gap-1.5 pl-3 pr-4">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor"
           strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      <span className="truncate">{label}</span>
    </Link>
  );
}
