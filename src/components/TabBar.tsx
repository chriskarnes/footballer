'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { haptic } from '@/lib/haptics';

// A floating pill rather than a full-width bar: it reads as an object on the page
// instead of chrome bolted to the bottom, and it lets content breathe past it.
const TABS = [
  { href: '/',        label: 'Train',   d: 'M13 3 4 14h7l-1 7 9-11h-7l1-7Z' },
  { href: '/library', label: 'Library', d: 'M4 5h16M4 12h16M4 19h9' },
  { href: '/plan',    label: 'Plan',    d: 'M4 5h16v16H4zM16 3v4M8 3v4M4 11h16' },
  { href: '/me',      label: 'Me',      d: 'M4 21v-1a6 6 0 0 1 12 0v1M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
];

export function TabBar() {
  const path = usePathname();
  return (
    // safe-b keeps the bar clear of the iPhone home indicator; without it the pill
    // sits underneath the gesture area and taps land on the wrong thing.
    <nav className="safe-b safe-x pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-pill border border-line/70
                      bg-surface/85 p-1.5 shadow-nav backdrop-blur-xl">
        {TABS.map((t) => {
          const on = t.href === '/' ? path === '/' : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
              onClick={() => { if (!on) haptic('tap'); }}
              // min-h-11 = 44px, Apple's minimum touch target. The visual pill is
              // smaller than the tappable area, which is how native bars work.
              className={`pressable flex min-h-11 items-center gap-2 rounded-pill px-4
                          text-[12.5px] font-bold tracking-tight
                          transition-colors duration-300
                          ${on ? 'bg-ink text-white' : 'text-faint'}`}>
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
