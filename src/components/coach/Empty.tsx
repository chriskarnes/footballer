import Link from 'next/link';

/**
 * A trainer list with nothing in it yet: what the thing is, in a line, and
 * the button that makes the first one. Every list page uses this one, so an
 * empty Programs, Groups, Sessions or Drills looks the same.
 */
export function Empty({ title, href, cta, extra, children }: {
  title: string; href: string; cta: string; children: React.ReactNode;
  /** A second way to start, beside the first: example sessions to copy. */
  extra?: React.ReactNode;
}) {
  return (
    <div className="card-flat p-5 lg:max-w-2xl">
      <div className="h-card">{title}</div>
      <p className="mt-1 text-body leading-relaxed text-on-surface-variant">{children}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={href} className="btn-primary btn-sm pressable">{cta}</Link>
        {extra}
      </div>
    </div>
  );
}
