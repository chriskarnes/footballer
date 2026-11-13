'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { haptic } from '@/lib/haptics';
import { useAcademyRole } from '@/lib/use-academy-role';

// A floating pill rather than a full-width bar: it reads as an object on the page
// instead of chrome bolted to the bottom, and it lets content breathe past it.
const TABS = [
  { href: '/',        label: 'Train',   d: 'M13 3 4 14h7l-1 7 9-11h-7l1-7Z' },
  { href: '/library', label: 'Library', d: 'M4 5h16M4 12h16M4 19h9' },
  { href: '/plan',    label: 'Plan',    d: 'M4 5h16v16H4zM16 3v4M8 3v4M4 11h16' },
  // A stopwatch. It had been a lightning bolt with speed lines, which next to
  // Train's bolt read as the same tab twice.
  { href: '/speed',   label: 'Speed',   d: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2.5M10 2h4M19 5l1.5 1.5' },
  { href: '/me',      label: 'Me',      d: 'M4 21v-1a6 6 0 0 1 12 0v1M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
];

// Trainers get a sixth tab, first, since the dashboard is why they open the
// app. A clipboard.
const COACH = { href: '/coach', label: 'Coach', d: 'M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 12h6M9 16h4' };

// A session opened from somewhere says so in ?from=, and keeps that tab lit.
const FROM: Record<string, string> = { train: '/', plan: '/plan', history: '/me', library: '/library' };

/**
 * The tab a page belongs to. A session is a step into the tab it was opened
 * from, not somewhere else, so that tab stays lit: Train's own sessions and
 * the ones it builds, and a session from Plan, Me's history or the Library.
 */
function tabFor(path: string, from: string | null): string | null {
  const session = path.startsWith('/session/') || path.startsWith('/speed/session/') || path.startsWith('/train/');
  if (session && from && FROM[from]) return FROM[from];
  if (path === '/' || path.startsWith('/train/') || path === '/session/custom') return '/';
  if (path.startsWith('/session/')) return '/library';
  return [COACH, ...TABS].find((t) => t.href !== '/' && path.startsWith(t.href))?.href ?? null;
}

type Props = {
  academyId: string | null;
  /** Whether this viewer gets Library, Plan and Speed: their trainer decides for players. */
  library?: boolean; plan?: boolean; speed?: boolean;
};

// Reading ?from= suspends a prerendered page, so the bar is drawn without it
// until the page is live; only session pages carry it.
export function TabBar(props: Props) {
  return <Suspense fallback={<Bar {...props} from={null} />}><BarFrom {...props} /></Suspense>;
}

function BarFrom(props: Props) {
  return <Bar {...props} from={useSearchParams().get('from')} />;
}

function Bar({ academyId, library = true, plan = true, speed = true, from }: Props & { from: string | null }) {
  const path = usePathname();
  const lit = tabFor(path, from);
  const role = useAcademyRole(academyId, path.startsWith('/coach'));
  const mine = TABS.filter((t) => (t.href !== '/library' || library) && (t.href !== '/plan' || plan) && (t.href !== '/speed' || speed));
  const tabs = role === 'owner' || role === 'trainer' ? [COACH, ...mine] : mine;
  // An invite, or a trainer claiming their academy, is one decision; the
  // app's tabs are for after it. Asking to join isn't: it's a wait, and the
  // tabs are the way on from it.
  if (path.startsWith('/join') || path.startsWith('/claim')) return null;
  return (
    // safe-b keeps the bar clear of the iPhone home indicator; without it the pill
    // sits underneath the gesture area and taps land on the wrong thing.
    <nav className="safe-b safe-x pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-outline-variant
                      tabbar-surface p-1.5 shadow-level2 backdrop-blur-xl">
        {tabs.map((t) => {
          const on = t.href === lit;
          return (
            // The tab you're on is in the brand's ink (primary: the kit colour,
            // darkened where it must be to read on white) with a short bar
            // under its name.
            // It had been a filled black blob, about as wide as it was tall, so
            // it read as a circle stamped on the bar.
            <Link key={t.href} href={t.href} aria-current={on ? (path === t.href ? 'page' : 'true') : undefined}
              onClick={() => { if (!on) haptic('tap'); }}
              className={`tab flex min-h-[52px] min-w-[54px] flex-col items-center justify-center rounded-xl px-3 pt-1
                          text-[11.5px] font-bold tracking-tight transition-colors duration-300
                          ${on ? 'text-primary' : 'text-on-surface-variant'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.3 : 1.9}
                   strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d={t.d} />
              </svg>
              {/* Always named: an icon alone asks a ten-year-old to guess. */}
              <span className="mt-0.5">{t.label}</span>
              {/* Always there, so the label doesn't jump when it shows. */}
              <span aria-hidden="true"
                    className={`mt-[3px] h-[3px] w-4 rounded-full bg-current transition-[opacity,transform] duration-300
                                ${on ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'}`} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
