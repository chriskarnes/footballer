import Link from 'next/link';
import { Brand } from '@/components/Brand';

const TABS = [
  { href: '/coach', label: 'Players' },
  { href: '/coach/groups', label: 'Groups' },
  { href: '/coach/content', label: 'Programs' },
  { href: '/coach/team', label: 'Team' },
] as const;

/** The trainer area's four places, under the academy's wordmark. */
export function CoachNav({ at }: { at: (typeof TABS)[number]['href'] }) {
  return (
    <header>
      <div className="app-bar"><Brand small /></div>
      <nav className="segmented mt-5 grid grid-cols-4" aria-label="Trainer area">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.href === at ? 'page' : undefined}
                className={`segment ${t.href === at ? 'segment-on' : ''}`}>{t.label}</Link>
        ))}
      </nav>
    </header>
  );
}
