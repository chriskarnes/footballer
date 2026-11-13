import type { Progress, Status } from '@/lib/progress';

const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SPOKEN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const STATUS_BG: Record<Status, string> = {
  good: 'bg-status-good', warn: 'bg-status-warn', bad: 'bg-status-bad',
};

export function StatusDot({ status, className = '' }: { status: Status; className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_BG[status]} ${className}`} />;
}

/**
 * The week at a glance, Monday to Sunday. Filled: trained. Red ring: a
 * planned day that's passed without a session. Dashed: planned, still to
 * come. Faint: a rest day. Today is only marked by its letter, on the large
 * version — a ring around it was one more thing to read on every card.
 */
export function WeekDots({ week, large }: { week: Progress['week']; large?: boolean }) {
  const size = large ? 'h-7 w-7' : 'h-2.5 w-2.5';
  // Read aloud as one line: the count, then any day planned and missed.
  const missed = week.map((d, i) => d.planned > d.done && !d.future && !d.today ? SPOKEN[i] : null).filter(Boolean);
  const trained = week.filter((d) => d.done).length;
  const said = `This week: trained ${trained} ${trained === 1 ? 'day' : 'days'}`
    + (missed.length ? `, missed ${missed.join(', ')}` : '');
  return (
    <div role="img" aria-label={said} className={`flex ${large ? 'justify-between' : 'gap-1.5'}`}>
      {week.map((d, i) => {
        const missed = d.planned > d.done && !d.future && !d.today;
        const cls = d.done ? 'bg-on-surface border-on-surface'
          : missed ? 'border-status-bad border-2'
          : d.planned ? 'border-outline border-dashed'
          : 'border-transparent bg-surface-container-high';
        return (
          <span key={d.date} className="flex flex-col items-center gap-1.5">
            <span className={`${size} rounded-full border ${cls}`} />
            {large && <span className={`text-label-sm ${d.today ? 'font-extrabold text-on-surface' : 'font-semibold text-on-surface-variant'}`}>{DAY[i]}</span>}
          </span>
        );
      })}
    </div>
  );
}
