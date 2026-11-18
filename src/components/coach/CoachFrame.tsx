'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { haptic } from '@/lib/haptics';
import { ToastProvider } from './Toast';

/**
 * The trainer area's frame. Not the player app with a Coach tab: its own
 * places, in a sidebar on a laptop (where rosters and programs get built) and
 * a bottom bar on a phone (where a trainer checks in and nudges).
 *
 * Lists get the full width on desktop; forms and editors keep a readable
 * column, since a 1200px-wide text field is harder to use, not easier.
 */
const PLACES = [
  // Players holds the list and the calendar (Week); Library, programs and
  // drills (an open book: it had the calendar's glyph, which said Week);
  // Settings, the academy's trainers, invite links and defaults (a gear: it
  // was "Academy", which didn't say what was in it).
  { href: '/coach',         label: 'Players',  match: ['/coach', '/coach/players', '/coach/week'],
    d: 'M4 21v-1a6 6 0 0 1 12 0v1M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { href: '/coach/groups',  label: 'Groups',   match: ['/coach/groups'],
    d: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 20a5.5 5.5 0 0 1 11 0M10.5 20a5.5 5.5 0 0 1 11 0' },
  { href: '/coach/content', label: 'Library',  match: ['/coach/content', '/coach/programs', '/coach/sessions', '/coach/drills'],
    d: 'M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z' },
  { href: '/coach/team',    label: 'Settings', match: ['/coach/team', '/coach/billing'],
    d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z' },
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
    <ToastProvider>
      {/* Desktop: the sidebar. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-outline-variant bg-surface-container-low px-3 py-6 lg:flex">
        <div className="px-3">{brand}</div>
        <p className="mt-1 px-3 text-caption font-semibold text-on-surface-variant">Trainer</p>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Trainer area">
          {PLACES.map((p) => {
            const on = isOn(path, p.match);
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
          <Icon d="M15 18l-6-6 6-6" />Player view
        </Link>
      </aside>

      <div className="lg:pl-60">
        {/* Phone: the wordmark, and the way back to training. */}
        <header className="safe-t safe-x mx-auto flex max-w-lg items-center justify-between px-5 lg:hidden">
          {brand}
          <Link href="/" className="text-body font-semibold text-on-surface-variant underline underline-offset-4">Player view</Link>
        </header>
        <main className={`safe-x mx-auto w-full max-w-lg px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-2
                          lg:px-10 lg:pb-16 lg:pt-10 ${wide ? 'lg:max-w-6xl' : 'lg:max-w-2xl'}`}>
          {children}
        </main>
      </div>

      {/* Phone: the trainer's own bar, not the player's, laid out the way the
          player's is (TabBar): every place named under its icon, and the one
          you're on in the brand's ink with a short bar under it. Only the
          lit one used to be named, which left three icons to guess at. */}
      <nav className="safe-b safe-x pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center lg:hidden" aria-label="Trainer area">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-outline-variant tabbar-surface p-1.5 shadow-level2 backdrop-blur-xl">
          {PLACES.map((p) => {
            const on = isOn(path, p.match);
            return (
              <Link key={p.href} href={p.href} aria-current={on ? 'page' : undefined}
                    onClick={() => { if (!on) haptic('tap'); }}
                    className={`tab flex min-h-13 min-w-[64px] flex-col items-center justify-center rounded-medium px-3 pt-1
                                text-caption font-bold tracking-tight transition-colors duration-300
                                ${on ? 'text-primary' : 'text-on-surface-variant'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.3 : 1.9}
                     strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d={p.d} /></svg>
                <span className="mt-0.5">{p.label}</span>
                {/* Always there, so the label doesn't jump when it shows. */}
                <span aria-hidden="true"
                      className={`mt-[3px] h-[3px] w-4 rounded-full bg-current transition-[opacity,transform] duration-300
                                  ${on ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'}`} />
              </Link>
            );
          })}
        </div>
      </nav>
    </ToastProvider>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round" className="size-4.5 shrink-0" aria-hidden="true"><path d={d} /></svg>
  );
}
