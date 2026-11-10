import Link from 'next/link';

/**
 * Two views of one place, as tabs above its heading: the player list and
 * the calendar; programs and drills.
 */
export function ViewTabs({ tabs, on }: { tabs: { href: string; label: string }[]; on: string }) {
  return (
    <nav className="mt-4 flex gap-2 lg:mt-0 lg:mb-6" aria-label="Views">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === on ? 'page' : undefined}
              className={`chip ${t.href === on ? 'chip-on' : ''}`}>{t.label}</Link>
      ))}
    </nav>
  );
}

export const PLAYER_VIEWS = [{ href: '/coach', label: 'List' }, { href: '/coach/week', label: 'Calendar' }];
export const LIBRARY_VIEWS = [{ href: '/coach/content', label: 'Programs' }, { href: '/coach/drills', label: 'Drills' }];
