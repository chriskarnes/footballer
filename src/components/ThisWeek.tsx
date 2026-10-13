'use client';
import { useEffect, useState } from 'react';
import { formatTouches } from '@/lib/session-builder';
import { streak, thisWeek, type Finished } from '@/lib/training-stats';
import { weekState, type Completion, type DayRow } from '@/lib/plan-today';

/**
 * How you're doing now, rather than in total. Lifetime sessions, minutes and
 * touches only ever go up, and a number that only goes up stops meaning
 * anything to a twelve-year-old after the first week. This week, the streak
 * and — with an active week — how much of it is done are numbers that move.
 *
 * The all-time totals stay, a line underneath. Waits for mount: the week is
 * the player's local week (see training-stats.ts).
 */
export function ThisWeek({
  finished, allTime, plan,
}: {
  finished: Finished[];
  allTime: { sessions: number; minutes: number; touches: number };
  plan: { name: string; days: DayRow[]; completions: Completion[] } | null;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  const week = now ? thisWeek(finished, now) : null;
  const run = now ? streak(finished, now) : 0;
  const progress = now && plan ? weekState(plan.days, plan.completions, now) : null;
  const pct = progress?.trainingCount
    ? Math.round((progress.doneCount / progress.trainingCount) * 100) : 0;

  return (
    <section className="mt-9">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="eyebrow">This week</p>
        {run > 1 && (
          <p className="text-[12.5px] font-semibold text-on-surface">{run} days in a row</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat v={week ? String(week.sessions) : '–'} k={week?.sessions === 1 ? 'Session' : 'Sessions'} />
        <Stat v={week ? String(week.minutes) : '–'} k="Min" />
        <Stat v={week ? formatTouches(week.touches) : '–'} k="Touches" />
      </div>

      {/* The active week's progress, with the same bar the Plan tab draws,
          so "2 of 4" here and there are visibly the same thing. */}
      {progress && progress.trainingCount > 0 && (
        <div className="card-flat mt-2.5 p-4">
          <div className="flex items-baseline justify-between gap-3 text-[12.5px] font-semibold">
            <span className="min-w-0 truncate text-on-surface">{plan!.name}</span>
            <span className="shrink-0 text-on-surface-variant">
              {progress.doneCount} of {progress.trainingCount} done
            </span>
          </div>
          <div className="mt-2.5 h-[6px] overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary transition-all duration-700"
                 style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <p className="mt-3 pl-1 text-[12.5px] font-medium text-on-surface-variant">
        All time: {allTime.sessions} session{allTime.sessions === 1 ? '' : 's'} ·{' '}
        {Math.round(allTime.minutes).toLocaleString('en-US')} min · {formatTouches(allTime.touches)} touches
      </p>
    </section>
  );
}

/** card-flat, as Plan's stat tiles are — the two had drifted into different
 *  cards for the same job. */
function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="card-flat p-4">
      <div className="font-brand text-[21px] font-bold leading-none tracking-tighter">{v}</div>
      <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">{k}</div>
    </div>
  );
}
