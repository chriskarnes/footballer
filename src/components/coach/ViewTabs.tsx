import Link from 'next/link';

/**
 * Two views of one place, above its heading: the player list and the
 * calendar; programs, sessions and drills. The segmented control, not chips:
 * chips are the filters below it (the groups), and a switch that looks like
 * a filter read as one.
 */
export function ViewTabs({ tabs, on }: { tabs: { href: string; label: string }[]; on: string }) {
  return (
    <nav className="segmented mt-4 max-w-md lg:mb-6 lg:mt-0" aria-label="Views">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === on ? 'page' : undefined}
              className={`segment pressable ${t.href === on ? 'segment-on' : ''}`}>{t.label}</Link>
      ))}
    </nav>
  );
}

export const PLAYER_VIEWS = [{ href: '/coach', label: 'List' }, { href: '/coach/week', label: 'Calendar' }];
export const LIBRARY_VIEWS = [{ href: '/coach/content', label: 'Programs' }, { href: '/coach/sessions', label: 'Sessions' }, { href: '/coach/drills', label: 'Drills' }];
