'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WEEKDAYS } from '@/lib/types';
import { dayKey, weekState, type Completion, type DayRow } from '@/lib/plan-today';

type Brief = { id: string; name: string; total_minutes: number };

/**
 * The card itself. An ordinary card, not the brand block: on Train the coach
 * box is the main event, and someone following a plan still often wants
 * something else today. Start is there for when they don't.
 *
 * Renders after mount, because what "today" is depends on the player's clock —
 * see plan-today.ts.
 */
export function TodayCard({
  planName, days, completions, sessions,
}: { planName: string; days: DayRow[]; completions: Completion[]; sessions: Brief[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  if (!now) return null;

  const byId = new Map(sessions.map((s) => [s.id, s]));
  const state = weekState(days, completions, now);
  const todo = state.todays.find((d) => !state.done.has(dayKey(d)));
  const session = todo?.session_id ? byId.get(todo.session_id) : null;
  const next = state.next && state.next.weekday !== state.today && state.next.session_id
    ? { day: WEEKDAYS[state.next.weekday], s: byId.get(state.next.session_id) } : null;
  const todayDone = !!state.todays.length && !todo;

  return (
    <Link href={session ? `/session/${session.id}?from=train` : '/plan'}
          className="card pressable animate-pop mt-6 flex items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Today on {planName}</p>
        <div className="h-card mt-1.5">
          {session ? session.name : todayDone ? 'Done for today' : 'Rest day'}
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
          {session
            ? `${Math.round(session.total_minutes)} min · ${state.doneCount} of ${state.trainingCount} done this week`
            : next?.s ? `Next up: ${next.day} — ${next.s.name}` : `${state.doneCount} of ${state.trainingCount} done this week`}
        </div>
      </div>
      {/* The whole card is the link; this is what it does, said as a button. */}
      {session
        ? <span className="btn-primary btn-sm shrink-0">Start</span>
        : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-on-surface-variant"
               fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>}
    </Link>
  );
}
