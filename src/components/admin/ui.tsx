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

/** A number with what it is, and an optional line under it. */
export function Stat({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-on-surface tabular-nums">{value}</p>
      {sub && <p className="mt-2 text-body-sm text-on-surface-variant">{sub}</p>}
    </>
  );
  return href
    ? <Link href={href} className="card block p-5">{body}</Link>
    : <div className="card p-5">{body}</div>;
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`whitespace-nowrap px-3 py-3 font-semibold first:pl-5 last:pr-5 ${right ? 'text-right' : ''}`}>{children}</th>;
}

export function Td({ children, right, strong, className = '' }: { children?: React.ReactNode; right?: boolean; strong?: boolean; className?: string }) {
  return (
    <td className={`px-3 py-3 first:pl-5 last:pr-5 ${right ? 'text-right tabular-nums' : ''} ${strong ? 'font-bold text-on-surface' : 'text-on-surface-variant'} ${className}`}>
      {children}
    </td>
  );
}

/** A table in a card, scrolling sideways on a phone rather than squeezing. */
export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card mt-4 overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-body">
        <thead className="border-b border-outline-variant eyebrow"><tr>{head}</tr></thead>
        <tbody className="divide-y divide-outline-variant">{children}</tbody>
      </table>
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="h-card">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function RoleTag({ role }: { role: string }) {
  const label = role === 'owner' ? 'Owner' : role === 'trainer' ? 'Trainer' : 'Player';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-caption font-semibold
      ${role === 'player' ? 'bg-surface-container-high text-on-surface-variant' : 'bg-inverse-surface text-inverse-on-surface'}`}>
      {label}
    </span>
  );
}
