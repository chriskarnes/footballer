'use client';
import { useEffect, useState } from 'react';
import { formatTouches } from '@/lib/session-builder';
import { thisWeek, weeksInARow, type Finished } from '@/lib/training-stats';
import { weekState, type Completion, type DayRow } from '@/lib/plan-today';

/**
 * How you're doing now, rather than in total. Lifetime sessions, minutes and
 * touches only ever go up, and a number that only goes up stops meaning
 * anything to a twelve-year-old after the first week. This week, weeks in a
 * row and — with a week from their trainer — how much of it is done are
 * numbers that move.
 *
 * `trainer` is the week their trainer set, counted the way Train counts it:
 * "3 of 4" in a ring, in place of a bare count of sessions.
 *
 * Waits for mount: the week is the player's local week (see training-stats.ts).
 *
 * `quiet`: the player is waiting for their trainer to set a week, so a row of
 * zeros would read as falling behind. Then it shows only once there's
 * something to count.
 */
export function ThisWeek({
  finished, plan, quiet = false, trainer = null,
}: {
  finished: Finished[];
  plan: { name: string; days: DayRow[]; completions: Completion[] } | null;
  quiet?: boolean;
  trainer?: { done: number; set: number } | null;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  const week = now ? thisWeek(finished, now) : null;
  const run = now ? weeksInARow(finished, now) : 0;
  const progress = now && plan ? weekState(plan.days, plan.completions, now) : null;
  const pct = progress?.trainingCount
    ? Math.round((progress.doneCount / progress.trainingCount) * 100) : 0;
  if (quiet && !week?.sessions && !progress?.trainingCount) return null;

  return (
    <section className="mt-10">
      <h2 className="h-sec mb-3">This week</h2>

      {/* Three numbers that move. */}
      <div className="grid grid-cols-3 gap-2.5">
        {trainer?.set
          ? <Ring done={trainer.done} of={trainer.set} />
          : <Stat v={week ? String(week.sessions) : '–'} k={week?.sessions === 1 ? 'session' : 'sessions'} />}
        <Stat v={week ? String(week.minutes) : '–'} k="minutes" />
        <Stat v={now ? String(run) : '–'} k={run === 1 ? 'week in a row' : 'weeks in a row'} />
      </div>
      {/* Library drills count touches; a trainer's own drills don't. */}
      {!!week?.touches && (
        <p className="mt-2 pl-1 text-[14px] font-semibold text-on-surface-variant">{formatTouches(week.touches)} touches this week</p>
      )}

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
    <div className="card-flat flex flex-col items-center justify-center px-2 py-4 text-center">
      <div className="font-brand text-[30px] font-extrabold leading-none tracking-tighter">{v}</div>
      <div className="mt-1.5 text-[14px] font-bold leading-tight text-on-surface-variant">{k}</div>
    </div>
  );
}

/** Sessions done of the ones their trainer set: a ring that fills, "3 of 4" in it. */
function Ring({ done, of }: { done: number; of: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const part = Math.min(1, done / of);
  return (
    <div className="card-flat flex flex-col items-center justify-center px-2 py-3 text-center"
         role="img" aria-label={`${done} of ${of} sessions done`}>
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-surface-container-high" />
          {part > 0 && (
            <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
                    className="stroke-primary transition-[stroke-dashoffset] duration-700"
                    strokeDasharray={c} strokeDashoffset={c * (1 - part)} />
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-brand text-[15px] font-extrabold tracking-tighter">
          {done} of {of}
        </span>
      </div>
      <div className="mt-1 text-[14px] font-bold leading-tight text-on-surface-variant">sessions</div>
    </div>
  );
}
