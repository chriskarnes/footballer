/**
 * The circle that stands for a player: their photo if they've added one,
 * otherwise the first initial of the name they chose (or of their email).
 * Never a silhouette, which says "no photo" when the actual state is "we
 * haven't asked you for one".
 *
 * The same brand pair a selected chip uses, so the circle is made of roles
 * the rest of the app spends rather than a colour chosen for this one place.
 */
export function initial(name?: string | null, email?: string): string {
  return ((name ?? '').trim() || (email ?? '').trim() || '?').charAt(0).toUpperCase();
}

export function Avatar({ name, email, src, className = 'h-14 w-14 text-title-lg', onBrand = false }: {
  name?: string | null; email?: string; src?: string | null; className?: string;
  /** On a block in the academy's colours, where the usual pair can be the
   *  block's own colour: the accent pair instead, the way the ticks there are. */
  onBrand?: boolean;
}) {
  const tone = onBrand ? 'accent-badge' : 'bg-secondary-container text-on-secondary-container';
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`shrink-0 rounded-full object-cover ${tone} ${className}`} />
  ) : (
    <span aria-hidden="true"
          className={`flex shrink-0 items-center justify-center rounded-full ${tone}
                      font-brand font-extrabold tracking-brand-snug ${className}`}>
      {initial(name, email)}
    </span>
  );
}
