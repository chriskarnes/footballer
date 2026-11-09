'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

export function TabBar({ academyId }: { academyId: string | null }) {
  const path = usePathname();
  const role = useAcademyRole(academyId, path.startsWith('/coach'));
  const tabs = role === 'owner' || role === 'trainer' ? [COACH, ...TABS] : TABS;
  return (
    // safe-b keeps the bar clear of the iPhone home indicator; without it the pill
    // sits underneath the gesture area and taps land on the wrong thing.
    <nav className="safe-b safe-x pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-outline-variant
                      tabbar-surface p-1.5 shadow-level2 backdrop-blur-xl">
        {tabs.map((t) => {
          const on = t.href === '/' ? path === '/' : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
              onClick={() => { if (!on) haptic('tap'); }}
              // min-h-11 = 44px, Apple's minimum touch target. The visual pill is
              // smaller than the tappable area, which is how native bars work.
              className={`pressable flex min-h-11 items-center gap-2 rounded-full px-4
                          text-[12.5px] font-bold tracking-tight
                          transition-colors duration-300
                          ${on ? 'bg-inverse-surface text-inverse-primary' : 'text-on-surface-variant'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                <path d={t.d} />
              </svg>
              <span className={on ? 'inline' : 'hidden sm:inline'}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
