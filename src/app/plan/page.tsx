import { getExercises, getSessions } from '@/lib/library';
import { libraryAllowed } from '@/lib/library-gate';
import { LibraryLocked } from '@/components/LibraryLocked';
import { serverClient } from '@/lib/supabase/server';
import { derivePrefill, type HistoryRow, type ProfileRow } from '@/lib/plan-builder';
import { PlanBuilder } from '@/components/PlanBuilder';
import { SavedWeek } from '@/components/SavedWeek';
import Link from 'next/link';
import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import type { Completion } from '@/lib/plan-today';
import type { DrillBrief, PlanIntake } from '@/lib/types';

type PlanRow = { id: string; name: string; active: boolean; intake: PlanIntake | null };

/**
 * The recurring order. Deliberately the LAST tab and the biggest ask, so it is
 * never a barrier to a first session.
 *
 * Everything here works signed out — you can build and adjust a week without an
 * account. Saving one signed out keeps it in the browser until you sign in (see
 * pending.ts), so the sign-in ask arrives after the value, not in front of it.
 *
 * Which screen, from the URL:
 *   ?edit=<id>   rebuild that saved week
 *   ?new=1       build another week alongside the ones you have
 *   ?plan=<id>   look at an inactive saved week
 *   (a week)     the builder's result step — see plan-url.ts
 *   (nothing)    the active week, or the builder if there isn't one
 */
export default async function PlanPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  if (!(await libraryAllowed())) return <LibraryLocked title="Plan" next="/plan" />;
  const one = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : undefined);
  const edit = one('edit'), view = one('plan'), fresh = !!one('new'), building = !!one('a');

  const [sessions, exercises] = await Promise.all([getSessions(), getExercises()]);

  // Slim index rather than the whole 471KB library: the week needs four
  // fields per drill, and this crosses the wire to a client component.
  const drillsBySession: Record<string, DrillBrief[]> = {};
  for (const e of [...exercises].sort((a, b) => a.exercise_order - b.exercise_order)) {
    (drillsBySession[e.session_id] ??= []).push({
      id: e.id, name: e.name, sets: e.sets,
      reps_time: e.reps_time, total_seconds: e.total_seconds,
    });
  }

  let signedIn = false;
  let hasPlans = false;
  let history: HistoryRow[] = [];
  let profile: ProfileRow | null = null;
  let shown: PlanRow | null = null;
  let editing: PlanRow | null = null;
  let days: { weekday: number; slot: number; kind: string; session_id: string | null }[] = [];
  let completions: Completion[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const db = await serverClient();
      const { data: auth } = await db.auth.getUser();
      signedIn = !!auth.user;

      if (auth.user) {
        const uid = auth.user.id;
        // Eight days back covers "this week" in any timezone; the browser
        // narrows it to its own Monday.
        const since = new Date(Date.now() - 8 * 86400000).toISOString();
        const [{ data: rows }, { data: prof }, { data: done }, { count: planCount }] = await Promise.all([
          db.from('workouts').select('created_at,planned_minutes,actual_minutes,spec,status')
            .order('created_at', { ascending: false }).limit(50),
          db.from('profiles').select('level,equipment,home_only,season_phase,weaknesses')
            .eq('id', uid).maybeSingle(),
          db.from('workouts').select('source_ref,completed_at')
            .eq('status', 'completed').eq('source', 'library').gte('completed_at', since),
          db.from('plans').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        ]);
        hasPlans = (planCount ?? 0) > 0;
        history = rows ?? [];
        profile = prof ?? null;
        completions = done ?? [];

        const pick = (id?: string) => {
          const base = db.from('plans').select('id,name,active,intake').eq('user_id', uid);
          return (id ? base.eq('id', id) : base.eq('active', true)).limit(1).maybeSingle();
        };
        if (edit) editing = (await pick(edit)).data as PlanRow | null;
        else if (!fresh && !building) shown = (await pick(view)).data as PlanRow | null;

        if (shown) {
          const { data } = await db.from('plan_days')
            .select('weekday,slot,kind,session_id')
            .eq('plan_id', shown.id).order('weekday').order('slot');
          days = data ?? [];
        }
      }
    } catch { /* not configured yet — fall through to the signed-out build */ }
  }

  // Plan opens like the other tabs: the band, with this week's name on it.
  // The way to every saved week sits in its corner, since the list of plans
  // lives on Me.
  // Only with a plan saved: Me lists them, and with none the link landed on nothing.
  const toPlans = hasPlans ? (
    <Link href="/me#plans" className="underline underline-offset-4">Your plans</Link>
  ) : undefined;

  if (shown) {
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const rows = days.map((d) => ({ ...d, session: d.session_id ? byId.get(d.session_id) ?? null : null }));
    const training = rows.filter((d) => d.kind !== 'rest' && d.session);
    const minutes = Math.round(training.reduce((a, d) => a + (d.session?.total_minutes ?? 0), 0));
    return (
      <div>
        <BrandBand right={toPlans}>
          <BandTag>Plan</BandTag>
          <BandTitle>{shown.name}</BandTitle>
          <p className="mt-3 text-title-sm font-semibold text-on-surface-brand-variant">
            {training.length} session{training.length === 1 ? '' : 's'} a week · {minutes} min
          </p>
        </BrandBand>
        <SavedWeek plan={{ id: shown.id, name: shown.name, active: shown.active }}
                   rows={rows} drillsBySession={drillsBySession} completions={completions} />
      </div>
    );
  }

  return (
    <div>
      <BrandBand right={toPlans}>
        <BandTag>Plan</BandTag>
        <BandTitle>{editing ? `Change ${editing.name}` : 'Make my week'}</BandTitle>
      </BrandBand>
    <PlanBuilder sessions={sessions} drillsBySession={drillsBySession}
      prefill={derivePrefill(history, profile)} signedIn={signedIn}
      editing={editing?.intake ? { id: editing.id, name: editing.name, intake: editing.intake } : null} />
    </div>
  );
}
