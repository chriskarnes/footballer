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
    <section className="mt-10">
      <h2 className="h-sec mb-3.5">This week</h2>

      {/* Three numbers that move. The streak takes the third tile until
          there are touches to count: a trainer's own drills don't have any. */}
      <div className="grid grid-cols-3 gap-2.5">
        <Stat v={week ? String(week.sessions) : '–'} k={week?.sessions === 1 ? 'session' : 'sessions'}
              icon="M20 6 9 17l-5-5" />
        <Stat v={week ? String(week.minutes) : '–'} k="minutes"
              icon="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2.5" />
        {week?.touches
          ? <Stat v={formatTouches(week.touches)} k="touches" icon="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8l3.5 2.5-1.3 4h-4.4l-1.3-4Z" />
          : <Stat v={now ? String(run) : '–'} k={run === 1 ? 'day in a row' : 'days in a row'}
                  icon="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5.3 1.2 1 2 2 2 .5-2 0-4.5.5-7Z" />}
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

/**
 * A number for the week, in the academy's colours: a tinted tile, the mark in
 * a solid disc, then the number big. Brand tokens only, so it follows the
 * academy and both colour schemes.
 */
function Stat({ v, k, icon }: { v: string; k: string; icon: string }) {
  return (
    <div className="rounded-[22px] px-2 pb-4 pt-3.5 text-center"
         style={{ background: 'color-mix(in srgb, var(--app-brand-primary) 11%, var(--md-sys-color-surface-container-lowest))' }}>
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-surface-brand text-on-surface-brand">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      </span>
      <div className="mt-2.5 font-brand text-[32px] font-extrabold leading-none tracking-tighter text-on-surface">{v}</div>
      <div className="mt-1.5 text-[13px] font-bold text-on-surface-variant">{k}</div>
    </div>
  );
}
