'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DrillBrief, SessionRow } from '@/lib/types';
import { WEEKDAYS } from '@/lib/types';
import { formatTouches } from '@/lib/session-builder';
import { dayKey, weekState, type Completion } from '@/lib/plan-today';
import { PlanWeek, type WeekRow } from './PlanWeek';
import { BackLink } from './BackLink';

const FULL_DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * A saved week. Read-only on purpose — this is the thing you follow, not the
 * thing you fiddle with; Rebuild is one tap away.
 *
 * The followed week leads with today, because "what am I doing today" is the
 * question this tab gets opened to answer, and the old screen made you find
 * today in a list of seven and work out what you'd already done. A week that's
 * saved but not followed shows the same list with Follow in place of today.
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
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  const [following, setFollowing] = useState(false);

  const state = now && plan.active
    ? weekState(rows.map((r) => ({ ...r, session_id: r.session?.id ?? null })), completions, now)
    : null;
  const byKey = new Map(rows.map((r) => [dayKey(r), r]));

  const training = rows.filter((d) => d.kind !== 'rest' && d.session);
  const minutes = Math.round(training.reduce((a, d) => a + (d.session?.total_minutes ?? 0), 0));
  const touches = training.reduce((a, d) => a + (d.session?.touches ?? 0), 0);

  async function follow() {
    setFollowing(true);
    const res = await fetch('/api/plans', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: plan.id, follow: true }),
    });
    if (res.ok) router.push('/plan');
    else setFollowing(false);
  }

  return (
    <div className="animate-pop">
      {/* The way to every saved week, and to renaming one. Plan is a tab, but
          the list of plans lives with the rest of your account. */}
      <BackLink href="/me#plans" label="Your plans" />
      <p className="eyebrow mb-3">{plan.active ? 'Following' : 'Saved week'}</p>
      <h1 className="h-hero">{plan.name}</h1>
      <p className="mt-3 text-[14px] font-medium text-on-surface-variant">
        {training.length} session{training.length === 1 ? '' : 's'} · {minutes} min · {formatTouches(touches)} touches a week
      </p>

      {plan.active && state && (
        <Today state={state} byKey={byKey} drillsBySession={drillsBySession} />
      )}

      {!plan.active && (
        <div className="mt-7 rounded-large-increased border border-brand-edge bg-surface-brand p-6 shadow-level3">
          <p className="text-[14px] font-medium text-on-surface-brand">
            You&rsquo;re not following this week. Follow it and it&rsquo;s the one Plan and Train
            show you each day.
          </p>
          <button onClick={follow} disabled={following}
                  className="btn-primary pressable mt-5 w-full bg-on-surface-brand text-surface-brand">
            {following ? 'Switching…' : 'Follow this week'}
          </button>
        </div>
      )}

      <h2 className="h-card mt-9">The week</h2>
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
    <div className="animate-pop mt-7 rounded-large-increased border border-brand-edge bg-surface-brand p-6 shadow-level3">
      <p className="text-[12.5px] font-semibold text-on-surface-brand-variant">
        Today · {FULL_DAY[state.today]}
      </p>

      {session ? (
        <>
          <SessionLine session={session} drills={drillsBySession[session.id]?.length ?? 0} />
          <Link href={`/session/${session.id}?from=plan`}
                className="btn-primary pressable mt-5 w-full bg-on-surface-brand text-surface-brand">
            Start
          </Link>
        </>
      ) : (
        <p className="mt-2 font-brand text-[26px] font-extrabold leading-tight tracking-tight text-on-surface-brand">
          {todayDone ? 'Done for today' : 'Rest day'}
        </p>
      )}

      {/* What's after today, so a rest day still says when you're next on. */}
      {!session && (
        <p className="mt-2 text-[13.5px] font-medium text-on-surface-brand-variant">
          {next?.session
            ? `Next up: ${WEEKDAYS[next.weekday]} — ${next.session.name}`
            : state.doneCount === state.trainingCount && state.trainingCount
              ? 'That’s the whole week done.'
              : 'Nothing else left this week.'}
        </p>
      )}

      <div className="mt-6 flex items-baseline justify-between text-[12px] font-semibold text-on-surface-brand-variant">
        <span>This week</span>
        <span>{state.doneCount} of {state.trainingCount} done</span>
      </div>
      <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-brand-track">
        <div className="h-full rounded-full bg-on-surface-brand transition-all duration-700"
             style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SessionLine({ session, drills }: { session: SessionRow; drills: number }) {
  return (
    <>
      <p className="mt-2 font-brand text-[24px] font-extrabold leading-tight tracking-tight text-on-surface-brand">
        {session.name}
      </p>
      <p className="mt-1.5 text-[12.5px] font-semibold text-on-surface-brand-variant">
        {Math.round(session.total_minutes)} min · {drills} drill{drills === 1 ? '' : 's'}
      </p>
    </>
  );
}
