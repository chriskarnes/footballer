/**
 * Route transition.
 *
 * `template.tsx` remounts on every navigation (unlike `layout.tsx`, which persists),
 * which is exactly what an enter animation needs. A screen that snaps into place
 * reads as a page load; one that lifts in reads as a push.
 *
 * Kept as a plain wrapper rather than the experimental View Transitions API: this
 * works in every browser today, including iOS Safari, with no flag.
 *
 * Note there is no `fixed`-position content inside pages — the tab bar and the
 * install sheet live in the layout, outside this wrapper — because an element with
 * an active transform becomes the containing block for its fixed descendants.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
