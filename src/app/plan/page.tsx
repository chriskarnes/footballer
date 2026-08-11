import Link from 'next/link';
import { Brand } from '@/components/Brand';

/**
 * The recurring order. Deliberately the LAST tab and the biggest ask, so it is
 * never a barrier to a first session. The pitch here is that history does most
 * of the work — see PLAN.md for the intake spec that ships next.
 */
export default function PlanPage() {
  return (
    <div>
      <p className="eyebrow mb-3">Plan</p>
      <h1 className="h-hero">Weekly<br />blueprint</h1>
      <p className="mt-3.5 max-w-[34ch] text-[15px] leading-relaxed text-muted">
        A repeating week built around your position, your weaknesses and the days you can actually train.
      </p>

      <div className="card mt-8 p-6">
        <div className="h-card">Not built yet</div>
        <p className="mt-1 text-sm text-muted">
          This is the one screen still to port from the prototype. The intake, the scoring and the
          day-by-day generator are all specified in <code className="text-xs">PLAN.md</code>, and the
          selection logic it needs already lives in{' '}
          <code className="text-xs">src/lib/session-builder.ts</code>.
        </p>
        <p className="mt-3 text-sm text-muted">
          The important change from the prototype: don&rsquo;t open with ten questions. Pre-fill
          position, level and focus from the player&rsquo;s history and ask only what&rsquo;s missing.
        </p>
        <Link href="/" className="btn-gold mt-4 inline-block px-4 py-2 text-sm">
          Train now instead →
        </Link>
      </div>
    </div>
  );
}
