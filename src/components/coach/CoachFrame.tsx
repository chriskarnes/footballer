'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { haptic } from '@/lib/haptics';

/**
 * The trainer area's frame. Not the player app with a Coach tab: its own
 * places, in a sidebar on a laptop (where rosters and programs get built) and
 * a bottom bar on a phone (where a trainer checks in and nudges).
 *
 * Lists get the full width on desktop; forms and editors keep a readable
 * column, since a 1200px-wide text field is harder to use, not easier.
 */
const PLACES = [
  // Players holds the list and the calendar (Week); Library, programs and drills.
  { href: '/coach',         label: 'Players',  match: ['/coach', '/coach/players', '/coach/send', '/coach/week'],
    d: 'M4 21v-1a6 6 0 0 1 12 0v1M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { href: '/coach/groups',  label: 'Groups',   match: ['/coach/groups'],
    d: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 20a5.5 5.5 0 0 1 11 0M10.5 20a5.5 5.5 0 0 1 11 0' },
  { href: '/coach/content', label: 'Library',  match: ['/coach/content', '/coach/programs', '/coach/sessions', '/coach/drills'],
    d: 'M4 5h16v15H4zM16 3v4M8 3v4M4 10h16M8 14h3M8 17h6' },
  { href: '/coach/team',    label: 'Academy',  match: ['/coach/team'],
    d: 'M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 12h6M9 16h4' },
] as const;

// Pages that use the width: tables and two-column views.
const WIDE = [/^\/coach$/, /^\/coach\/week$/, /^\/coach\/groups$/, /^\/coach\/content$/, /^\/coach\/drills$/, /^\/coach\/sessions$/, /^\/coach\/players\/[^/]+$/];

function isOn(path: string, match: readonly string[]) {
  return match.some((m) => m === '/coach' ? path === '/coach' : path === m || path.startsWith(`${m}/`));
}

export function CoachFrame({ brand, children }: { brand: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const wide = WIDE.some((r) => r.test(path));

  return (
    <>
      {/* Desktop: the sidebar. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-outline-variant bg-surface-container-low px-3 py-6 lg:flex">
        <div className="px-3">{brand}</div>
        <p className="mt-1 px-3 text-[12px] font-semibold text-on-surface-variant">Trainer</p>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Trainer area">
          {PLACES.map((p) => {
            const on = isOn(path, p.match);
            return (
              <Link key={p.href} href={p.href} aria-current={on ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-[14.5px] font-semibold transition-colors
                      ${on ? 'bg-inverse-surface text-inverse-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                <Icon d={p.d} />{p.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/" className="mt-auto flex min-h-11 items-center gap-3 rounded-full px-4 text-[13.5px] font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
          <Icon d="M15 18l-6-6 6-6" />Player view
        </Link>
      </aside>

      <div className="lg:pl-60">
        {/* Phone: the wordmark, and the way back to training. */}
        <header className="safe-t safe-x mx-auto flex max-w-lg items-center justify-between px-5 lg:hidden">
          {brand}
          <Link href="/" className="text-[13px] font-semibold text-on-surface-variant underline underline-offset-4">Player view</Link>
        </header>
        <main className={`safe-x mx-auto w-full max-w-lg px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-2
                          lg:px-10 lg:pb-16 lg:pt-10 ${wide ? 'lg:max-w-6xl' : 'lg:max-w-2xl'}`}>
          {children}
        </main>
      </div>

      {/* Phone: the trainer's own bar, not the player's. */}
      <nav className="safe-b safe-x pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center lg:hidden" aria-label="Trainer area">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-outline-variant tabbar-surface p-1.5 shadow-level2 backdrop-blur-xl">
          {PLACES.map((p) => {
            const on = isOn(path, p.match);
            return (
              <Link key={p.href} href={p.href} aria-current={on ? 'page' : undefined}
                    onClick={() => { if (!on) haptic('tap'); }}
                    className={`pressable flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-bold tracking-tight transition-colors duration-300
                      ${on ? 'bg-inverse-surface text-inverse-primary' : 'text-on-surface-variant'}`}>
                <Icon d={p.d} />
                <span className={on ? 'inline' : 'sr-only'}>{p.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0" aria-hidden="true"><path d={d} /></svg>
  );
}
