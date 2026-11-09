import type { Progress, Status } from '@/lib/progress';

const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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
  return (
    <div className={`flex ${large ? 'justify-between' : 'gap-1.5'}`}
         aria-label={`This week: ${week.filter((d) => d.done).length} days trained`}>
      {week.map((d, i) => {
        const missed = d.planned > d.done && !d.future && !d.today;
        const cls = d.done ? 'bg-on-surface border-on-surface'
          : missed ? 'border-status-bad border-2'
          : d.planned ? 'border-outline border-dashed'
          : 'border-transparent bg-surface-container-high';
        return (
          <span key={d.date} className="flex flex-col items-center gap-1.5">
            <span className={`${size} rounded-full border ${cls}`} />
            {large && <span className={`text-[11px] ${d.today ? 'font-extrabold text-on-surface' : 'font-semibold text-on-surface-variant'}`}>{DAY[i]}</span>}
          </span>
        );
      })}
    </div>
  );
}
