import Link from 'next/link';
import { SignIn } from '@/components/SignIn';

/** What a non-admin sees instead of the page. */
export function AdminGate({ gate, next }: { gate: 'signin' | 'denied'; next: string }) {
  return (
    <div className="max-w-md pt-4">
      <h1 className="h-page">{gate === 'signin' ? 'Platform admin' : 'Admins only'}</h1>
      {gate === 'signin'
        ? <div className="mt-5"><SignIn next={next} /></div>
        : <p className="mt-3 text-body text-on-surface-variant">This account isn&rsquo;t a platform admin.</p>}
    </div>
  );
}

export function Failed({ error }: { error: string }) {
  return <p role="alert" className="card mt-6 p-5 text-body text-on-surface">{error}</p>;
}

/** The top of every admin page: its name, a line about it, and what you can do there. */
export function PageHead({ title, sub, tags, actions }: { title: React.ReactNode; sub?: React.ReactNode; tags?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="h-page">{title}</h1>
        {tags && <div className="mt-3 flex flex-wrap gap-1.5">{tags}</div>}
        {sub && <p className="mt-3 max-w-2xl text-body leading-relaxed text-on-surface-variant">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}

const TONES = {
  plain: 'bg-surface-container-high text-on-surface-variant',
  dark: 'bg-inverse-surface text-inverse-on-surface',
  good: 'bg-[#DDF3E4] text-[#14532D] dark:bg-[#173B26] dark:text-[#B7EBC6]',
  wait: 'bg-[#FFF0C7] text-[#6B4A00] dark:bg-[#40310A] dark:text-[#FFDF8A]',
  rose: 'bg-[#FCE4EC] text-[#9B1C45] dark:bg-[#4A1F2D] dark:text-[#FFC2D4]',
} as const;

/** A word about where something stands, in colour where the colour says something. */
export function Tag({ children, tone = 'plain' }: { children: React.ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption font-semibold ${TONES[tone]}`}>{children}</span>;
}

/** A glyph that goes somewhere: the site, an email. Named for a screen reader and on hover. */
export function IconLink({ href, label, d, external }: { href: string; label: string; d: string; external?: boolean }) {
  return (
    <a href={href} aria-label={label} title={label} className="icon-btn bg-transparent text-on-surface-variant hover:text-on-surface"
       {...(external && { target: '_blank', rel: 'noreferrer' })}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
    </a>
  );
}
export const ICON = {
  open: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  copy: 'M9 9h10v11H9zM5 15V4h10',
} as const;

/** The numbers at the top of a page, in the open: no boxes, room between them. */
export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-y border-outline-variant py-8 lg:grid-cols-4">{children}</div>;
}

/** A number with what it is, and an optional line under it. */
export function Stat({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="mt-2.5 text-[2.25rem] font-bold leading-none tracking-tight text-on-surface tabular-nums">{value}</p>
      {sub && <p className="mt-2.5 text-body-sm leading-snug text-on-surface-variant">{sub}</p>}
    </>
  );
  return href
    ? <Link href={href} className="group block rounded-lg [&_.eyebrow]:hover:text-on-surface [&_.eyebrow]:hover:underline">{body}</Link>
    : <div>{body}</div>;
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`whitespace-nowrap px-3 pb-3 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>;
}

export function Td({ children, right, strong, className = '' }: { children?: React.ReactNode; right?: boolean; strong?: boolean; className?: string }) {
  return (
    <td className={`px-3 py-4 align-middle first:rounded-l-xl last:rounded-r-xl ${right ? 'text-right tabular-nums' : ''} ${strong ? 'font-bold text-on-surface' : 'text-on-surface-variant'} ${className}`}>
      {children}
    </td>
  );
}

/** A table in the open, scrolling sideways on a phone rather than squeezing. */
export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="-mx-3 mt-5 overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-body">
        <thead className="eyebrow border-b border-outline-variant"><tr>{head}</tr></thead>
        <tbody className="divide-y divide-outline-variant">{children}</tbody>
      </table>
    </div>
  );
}

/** Rows in the open, a line between each. */
export function Rows({ children }: { children: React.ReactNode }) {
  return <ul className="mt-5 divide-y divide-outline-variant border-t border-outline-variant">{children}</ul>;
}

export function Section({ title, count, children, action, id }: { title: string; count?: number; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-14 scroll-mt-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="h-card">{title}{count !== undefined && <span className="ml-2 font-normal text-on-surface-variant tabular-nums">{count.toLocaleString('en-US')}</span>}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-body text-on-surface-variant">{children}</p>;
}

/** What's worth knowing once, folded away so it isn't read every visit. */
export function Aside({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="mt-4 text-body-sm text-on-surface-variant">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-semibold hover:text-on-surface [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></svg>
        {label}
      </summary>
      <div className="mt-2 max-w-2xl leading-relaxed">{children}</div>
    </details>
  );
}

export function RoleTag({ role }: { role: string }) {
  return <Tag tone={role === 'player' ? 'plain' : 'dark'}>{role === 'owner' ? 'Owner' : role === 'trainer' ? 'Trainer' : 'Player'}</Tag>;
}

/** Previous and next, with where you are, under a list that runs to pages. */
export function Pager({ page, per, total, href, label }: { page: number; per: number; total: number; href: (page: number) => string; label: string }) {
  const pages = Math.max(1, Math.ceil(total / per));
  if (pages <= 1) return null;
  const link = 'btn-ghost btn-sm pressable';
  const off = `${link} pointer-events-none opacity-40`;
  return (
    <nav className="mt-8 flex flex-wrap items-center gap-3 text-body" aria-label={label}>
      {page > 0 ? <Link href={href(page - 1)} scroll={false} className={link}>Previous</Link> : <span aria-disabled="true" className={off}>Previous</span>}
      {page + 1 < pages ? <Link href={href(page + 1)} scroll={false} className={link}>Next</Link> : <span aria-disabled="true" className={off}>Next</span>}
      <span className="ml-1 text-body-sm text-on-surface-variant tabular-nums">
        {(page * per + 1).toLocaleString('en-US')}–{Math.min(total, (page + 1) * per).toLocaleString('en-US')} of {total.toLocaleString('en-US')} · page {page + 1} of {pages}
      </span>
    </nav>
  );
}
