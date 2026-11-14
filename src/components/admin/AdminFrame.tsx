'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The platform admin panel's frame: every academy and account, for the
 * people in `admins`. A desk tool, so a sidebar and the full width on a
 * laptop; on a phone the places sit in a row under the wordmark.
 */
const PLACES = [
  { href: '/admin',           label: 'Overview',  d: 'M4 13h6V4H4zM14 20h6v-9h-6zM14 4h6v4h-6zM4 20h6v-3H4z' },
  { href: '/admin/academies', label: 'Academies', d: 'M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 12h6M9 16h4' },
  { href: '/admin/users',     label: 'People',    d: 'M4 21v-1a6 6 0 0 1 12 0v1M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { href: '/admin/requests',  label: 'Requests',  d: 'M4 6h16v12H4zM4 7l8 6 8-6' },
] as const;

const isOn = (path: string, href: string) =>
  href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`);

export function AdminFrame({ brand, children }: { brand: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-outline-variant bg-surface-container-low px-3 py-6 lg:flex">
        <div className="px-3">{brand}</div>
        <p className="mt-1 px-3 text-caption font-semibold text-on-surface-variant">Platform admin</p>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Admin">
          {PLACES.map((p) => {
            const on = isOn(path, p.href);
            return (
              <Link key={p.href} href={p.href} aria-current={on ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-body-lg font-semibold transition-colors
                      ${on ? 'bg-inverse-surface text-inverse-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                <Icon d={p.d} />{p.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/" className="mt-auto flex min-h-11 items-center gap-3 rounded-full px-4 text-body font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
          <Icon d="M15 18l-6-6 6-6" />Back to the app
        </Link>
      </aside>

      <div className="lg:pl-60">
        <header className="safe-t safe-x px-5 pt-3 lg:hidden">
          <div className="flex items-center justify-between">
            {brand}
            <Link href="/" className="text-body font-semibold text-on-surface-variant underline underline-offset-4">Back to the app</Link>
          </div>
          <nav className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1" aria-label="Admin">
            {PLACES.map((p) => {
              const on = isOn(path, p.href);
              return (
                <Link key={p.href} href={p.href} aria-current={on ? 'page' : undefined}
                      className={`chip shrink-0 ${on ? 'chip-on' : ''}`}>
                  {p.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="safe-x mx-auto w-full max-w-6xl px-5 pb-16 pt-4 lg:px-10 lg:pt-10">{children}</main>
      </div>
    </>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round" className="size-4.5 shrink-0" aria-hidden="true"><path d={d} /></svg>
  );
}
