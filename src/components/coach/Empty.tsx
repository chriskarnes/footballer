import Link from 'next/link';

/**
 * A trainer list with nothing in it yet: what the thing is, in a line, and
 * the button that makes the first one. Every list page uses this one, so an
 * empty Programs, Groups, Sessions or Drills looks the same.
 */
export function Empty({ title, href, cta, children }: { title: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <div className="card-flat p-5 lg:max-w-2xl">
      <div className="h-card">{title}</div>
      <p className="mt-1 text-[14px] leading-relaxed text-on-surface-variant">{children}</p>
      <Link href={href} className="btn-ghost btn-sm pressable mt-4">{cta}</Link>
    </div>
  );
}
