'use client';
import { useNow } from '@/lib/use-now';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DrillBrief, SessionRow } from '@/lib/types';
import { WEEKDAYS } from '@/lib/types';
import { dayKey, weekState, type Completion } from '@/lib/plan-today';
import { PlanWeek, type WeekRow } from './PlanWeek';
import { splitSessionName } from '@/lib/program-copy';

const FULL_DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * A saved week. Read-only on purpose — this is the week you train to, not the
 * thing you fiddle with; Rebuild is one tap away.
 *
 * The week in use ("active" in the data) leads with today, because "what am
 * I doing today" is the question this tab gets opened to answer, and the old
 * screen made you find today in a list of seven and work out what you'd
 * already done. Any other week shows the same list with Use this week in
 * place of today: one tap, no sheet to confirm, since switching back is the
 * same tap on the other week.
 */
export function SavedWeek({
  plan, rows, drillsBySession, completions,
}: {
  plan: { id: string; name: string; active: boolean };
  rows: WeekRow[];
  drillsBySession: Record<string, DrillBrief[]>;
  completions: Completion[];
}) {
  const router = useRouter();
  // The local day is only known in the browser, so today and the ticks
  // arrive after mount. See plan-today.ts.
  const now = useNow();
  const [switching, setSwitching] = useState(false);
  const [err, setErr] = useState('');

  const state = now && plan.active
    ? weekState(rows.map((r) => ({ ...r, session_id: r.session?.id ?? null })), completions, now)
    : null;
  const byKey = new Map(rows.map((r) => [dayKey(r), r]));


  async function activate() {
    setSwitching(true); setErr('');
    const res = await fetch('/api/plans', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: plan.id, follow: true }),
    }).catch(() => null);
    if (res?.ok) router.push('/plan');
    else { setSwitching(false); setErr(res ? 'Couldn’t save that. Try again.' : 'No signal. Try again.'); }
  }

  return (
    <div className="animate-pop">
      {/* The week's name and numbers are in the band above (plan/page). */}

      {plan.active && state && (
        <Today state={state} byKey={byKey} drillsBySession={drillsBySession} />
      )}

      {!plan.active && (
        <div className="mt-7 brand-card p-6">
          <p className="text-body font-medium text-on-surface-brand">
            You&rsquo;re not using this week. Use it?
          </p>
          <button onClick={activate} disabled={switching}
                  className="btn-primary btn-on-brand btn-big pressable mt-5 w-full">
            {switching ? 'One moment…' : 'Use this week'}
          </button>
          {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface-brand">{err}</p>}
        </div>
      )}

      <h2 className="h-card mt-9">Your week</h2>
      <PlanWeek rows={rows} drillsBySession={drillsBySession}
                done={state?.done} today={state?.today ?? null} />

      <Link href={`/plan?edit=${plan.id}`} className="btn-ghost pressable mt-8 w-full">
        Rebuild this week
      </Link>
    </div>
  );
}

/**
 * Today, on the brand block: the session to do, with Start — or that it's
 * done, or a rest day — and how the week is going underneath.
 */
function Today({
  state, byKey, drillsBySession,
}: {
  state: ReturnType<typeof weekState>;
  byKey: Map<string, WeekRow>;
  drillsBySession: Record<string, DrillBrief[]>;
}) {
  const todo = state.todays.find((d) => !state.done.has(dayKey(d)));
  const todayDone = !!state.todays.length && !todo;
  const next = state.next && state.next.weekday !== state.today ? byKey.get(dayKey(state.next)) : null;
  const pct = state.trainingCount ? Math.round((state.doneCount / state.trainingCount) * 100) : 0;
  const session = todo ? byKey.get(dayKey(todo))?.session : null;

  return (
    <div className="animate-pop mt-7 brand-card p-6">
      <p className="text-body-sm font-semibold text-on-surface-brand-variant">
        Today · {FULL_DAY[state.today]}
      </p>

      {session ? (
        <>
          <SessionLine session={session} drills={drillsBySession[session.id]?.length ?? 0} />
          <Link href={`/session/${session.id}?from=plan`}
                className="btn-primary btn-on-brand btn-big pressable mt-5 w-full">
            Start
          </Link>
        </>
      ) : (
        <p className="mt-2 font-brand text-headline font-extrabold leading-tight tracking-tight text-on-surface-brand">
          {todayDone ? 'Done for today' : 'Rest day'}
        </p>
      )}

      {/* What's after today, so a rest day still says when you're next on. */}
      {!session && (
        <p className="mt-2 text-body font-medium text-on-surface-brand-variant">
          {next?.session
            ? `Next up: ${WEEKDAYS[next.weekday]} — ${splitSessionName(next.session.name).title}`
            : state.doneCount === state.trainingCount && state.trainingCount
              ? 'That’s the whole week done.'
              : 'Nothing else left this week.'}
        </p>
      )}

      <div className="mt-6 flex items-baseline justify-between text-caption font-semibold text-on-surface-brand-variant">
        <span>This week</span>
        <span>{state.doneCount} of {state.trainingCount} done</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-track">
        <div className="h-full rounded-full bg-brand-accent transition-all duration-700"
             style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SessionLine({ session, drills }: { session: SessionRow; drills: number }) {
  return (
    <>
      <p className="mt-2 font-brand text-display font-extrabold leading-tight tracking-tight text-on-surface-brand">
        {splitSessionName(session.name).title}
      </p>
      <p className="mt-1.5 text-body-sm font-semibold text-on-surface-brand-variant">
        {Math.round(session.total_minutes)} min · {drills} drill{drills === 1 ? '' : 's'}
      </p>
    </>
  );
}
