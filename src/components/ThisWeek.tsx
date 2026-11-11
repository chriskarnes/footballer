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
 * Waits for mount: the week is the player's local week (see training-stats.ts).
 */
export function ThisWeek({
  finished, plan,
}: {
  finished: Finished[];
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
    <section className="mt-8">
      <h2 className="h-sec mb-3">This week</h2>

      {/* Three numbers that move. The streak takes the third tile until
          there are touches to count: a trainer's own drills don't have any. */}
      <div className="grid grid-cols-3 gap-2.5">
        <Stat v={week ? String(week.sessions) : '–'} k={week?.sessions === 1 ? 'session' : 'sessions'} />
        <Stat v={week ? String(week.minutes) : '–'} k="minutes" />
        {week?.touches
          ? <Stat v={formatTouches(week.touches)} k="touches" />
          : <Stat v={now ? String(run) : '–'} k={run === 1 ? 'day in a row' : 'days in a row'} />}
      </div>

      {/* The active week's progress, with the same bar the Plan tab draws. */}
      {progress && progress.trainingCount > 0 && (
        <div className="card-flat mt-2.5 p-4">
          <div className="flex items-baseline justify-between gap-3 text-[14px] font-bold">
            <span className="min-w-0 truncate text-on-surface">{plan!.name}</span>
            <span className="shrink-0 text-on-surface-variant">
              {progress.doneCount} of {progress.trainingCount}
            </span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary transition-all duration-700"
                 style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="card-flat px-3 py-4 text-center">
      <div className="font-brand text-[30px] font-extrabold leading-none tracking-tighter">{v}</div>
      <div className="mt-1.5 text-[12.5px] font-bold text-on-surface-variant">{k}</div>
    </div>
  );
}
