import Link from 'next/link';
import { getExercises, getSessions } from '@/lib/library';
import { serverClient } from '@/lib/supabase/server';
import { derivePrefill, type HistoryRow, type ProfileRow } from '@/lib/plan-builder';
import { PlanBuilder } from '@/components/PlanBuilder';
import { PlanWeek } from '@/components/PlanWeek';
import type { DrillBrief, SessionRow } from '@/lib/types';

/**
 * The recurring order. Deliberately the LAST tab and the biggest ask, so it is
 * never a barrier to a first session.
 *
 * Everything here works signed out — you can build and adjust a week without an
 * account, you just can't keep it. That matches Train Now, and it means the
 * sign-in ask arrives after the value rather than in front of it.
 */
export default async function PlanPage({
  searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const [sessions, exercises] = await Promise.all([getSessions(), getExercises()]);

  // Slim index rather than the whole 471KB library: the blueprint needs four
  // fields per drill, and this crosses the wire to a client component.
  const drillsBySession: Record<string, DrillBrief[]> = {};
  for (const e of [...exercises].sort((a, b) => a.exercise_order - b.exercise_order)) {
    (drillsBySession[e.session_id] ??= []).push({
      id: e.id, name: e.name, sets: e.sets,
      reps_time: e.reps_time, total_seconds: e.total_seconds,
    });
  }

  let signedIn = false;
  let history: HistoryRow[] = [];
  let profile: ProfileRow | null = null;
  let saved: { id: string; days: { weekday: number; slot: number; kind: string; session_id: string | null }[] } | null = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const db = await serverClient();
      const { data: auth } = await db.auth.getUser();
      signedIn = !!auth.user;

      if (auth.user) {
        const [{ data: rows }, { data: prof }, { data: plans }] = await Promise.all([
          db.from('workouts').select('created_at,planned_minutes,actual_minutes,spec,status')
            .order('created_at', { ascending: false }).limit(50),
          db.from('profiles').select('level,equipment,home_only,season_phase,weaknesses')
            .eq('id', auth.user.id).maybeSingle(),
          db.from('plans').select('id').eq('user_id', auth.user.id).eq('active', true).limit(1),
        ]);
        history = rows ?? [];
        profile = prof ?? null;

        if (plans?.length) {
          const { data: days } = await db.from('plan_days')
            .select('weekday,slot,kind,session_id')
            .eq('plan_id', plans[0].id)
            .order('weekday').order('slot');
          saved = { id: plans[0].id, days: days ?? [] };
        }
      }
    } catch { /* not configured yet — fall through to the signed-out build */ }
  }

  const prefill = derivePrefill(history, profile);

  return (
    <div>
      <p className="eyebrow mb-3">Plan</p>
      <h1 className="h-hero">Weekly<br />blueprint</h1>
      <p className="mt-3.5 max-w-[34ch] text-[15px] leading-relaxed text-on-surface-variant">
        A repeating week built around your weaknesses, your kit and the days you can
        actually train.
      </p>

      {saved && !edit
        ? <SavedWeek days={saved.days} sessions={sessions} drillsBySession={drillsBySession} />
        : <PlanBuilder sessions={sessions} drillsBySession={drillsBySession}
            prefill={prefill} signedIn={signedIn} />}
    </div>
  );
}

/** The week as it was saved. Read-only on purpose — this is the thing you follow,
 *  not the thing you fiddle with. Rebuilding is one tap away. */
function SavedWeek({
  days, sessions, drillsBySession,
}: {
  days: { weekday: number; slot: number; kind: string; session_id: string | null }[];
  sessions: SessionRow[];
  drillsBySession: Record<string, DrillBrief[]>;
}) {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const resolved = days.map((d) => ({ ...d, session: d.session_id ? byId.get(d.session_id) ?? null : null }));
  const training = resolved.filter((d) => d.kind !== 'rest');
  const minutes = Math.round(training.reduce((a, d) => a + (d.session?.total_minutes ?? 0), 0));
  const touches = training.reduce((a, d) => a + (d.session?.touches ?? 0), 0);

  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="h-card">This week</h2>
        <Link href="/plan?edit=1"
          className="text-[13px] font-semibold text-primary underline underline-offset-4">
          Rebuild
        </Link>
      </div>

      <div className="mt-3.5 flex gap-2.5">
        <Stat v={String(training.length)} k="sessions" />
        <Stat v={`${minutes}m`} k="a week" />
        <Stat v={touches >= 1000 ? `${(touches / 1000).toFixed(1)}k` : String(touches)} k="touches" />
      </div>

      <PlanWeek rows={resolved} drillsBySession={drillsBySession} />
    </div>
  );
}

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="card-flat flex-1 p-3">
      <div className="font-brand text-[19px] font-bold leading-none tracking-tighter">{v}</div>
      <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">{k}</div>
    </div>
  );
}
