'use client';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildPlan, defaultPlanName, planDayRows, swapPlanDay, type Prefill } from '@/lib/plan-builder';
import { decodePlan, encodePlan, PLAN_KEYS } from '@/lib/plan-url';
import { formatTouches } from '@/lib/session-builder';
import { pendingPlan } from '@/lib/pending';
import { PlanWeek } from './PlanWeek';
import { Chip } from './Chip';
import { BackButton } from './BackLink';
import type {
  Availability, BuiltPlan, DrillBrief, FocusArea, PlanIntake, SessionRow,
} from '@/lib/types';
import { FOCUS_LABELS, WEEKDAYS } from '@/lib/types';

const PHASES: [PlanIntake['seasonPhase'], string, string][] = [
  ['off', 'Off-season', 'Longest sessions — this is when volume goes in'],
  ['pre', 'Pre-season', 'Building up, matches not yet the priority'],
  ['in', 'In-season', 'Short and sharp, so matches come first'],
];

const CYCLE: Availability[] = ['rest', 'technical', 'physical', 'both'];
/** All four letters wide on purpose: a seven-column grid on a 375px screen has
 *  about 45px per day, and "Physical" overflowed its chip. */
const DAY_LABEL: Record<Availability, string> = {
  rest: 'Rest', technical: 'Ball', physical: 'Phys', both: 'Both',
};
/** Spelled out for screen readers, which have no width problem. */
const DAY_SPOKEN: Record<Availability, string> = {
  rest: 'Rest', technical: 'Ball work', physical: 'Physical', both: 'Ball work and physical',
};

const KIT = ['ball', 'cones', 'wall', 'goal', 'box', 'ladder', 'hurdles', 'weights', 'jump_rope', 'partner'];
const KIT_LABEL: Record<string, string> = {
  ball: 'Ball', cones: 'Cones', wall: 'Wall', goal: 'Goal', box: 'Box',
  ladder: 'Ladder', hurdles: 'Hurdles', weights: 'Weights',
  jump_rope: 'Skipping rope', partner: 'A partner',
};

type Props = {
  sessions: SessionRow[];
  drillsBySession: Record<string, DrillBrief[]>;
  prefill: Prefill;
  signedIn: boolean;
  /** Rebuilding a saved week: it opens with that week's answers, and saving
   *  replaces its days rather than making a new plan. */
  editing?: { id: string; name: string; intake: PlanIntake } | null;
};

/**
 * The blueprint screen, in two steps — the same shape Train has: what you
 * want, then the week that came out of it.
 *
 * It used to be one long page that regenerated the week underneath the
 * questions as you tapped, with Save two and a half screens down. Nothing
 * marked the week as made, so it read as browsing. Now Build my week is the
 * moment it's made, and the result is its own step with Save as its one action.
 *
 * PLAN.md's instruction for the first step still holds — "do not open with ten
 * questions" — so everything the prefill already knows is shown as a stated
 * fact you can correct, and the only thing asked outright is whether you're
 * injured.
 *
 * The step lives in the URL (plan-url.ts). useSearchParams needs Suspense or
 * the page can't render without it; the fallback is the questions step, which
 * is what a render with no query string is anyway.
 */
export function PlanBuilder(props: Props) {
  return (
    <Suspense fallback={<Builder {...props} params={null} />}>
      <BuilderFromUrl {...props} />
    </Suspense>
  );
}

function BuilderFromUrl(props: Props) {
  return <Builder {...props} params={useSearchParams()} />;
}

function Builder({
  sessions, drillsBySession, prefill, signedIn, editing, params,
}: Props & { params: { get(k: string): string | null } | null }) {
  const router = useRouter();
  const plan = useMemo(() => (params ? decodePlan(params, sessions) : null), [params, sessions]);

  const [intake, setIntake] = useState<PlanIntake>(editing?.intake ?? prefill.intake);
  const [save, setSave] = useState<'idle' | 'saving' | 'signin' | 'error'>('idle');
  const [error, setError] = useState('');
  // Whether this visit pushed the result step — if so Back is the back
  // gesture; if the week arrived by URL, going back would leave the tab.
  const pushed = useRef(false);

  // A week that arrived by URL fills the questions it came from, so Back lands
  // on answers that describe it.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !plan) return;
    seeded.current = true;
    setIntake(plan.intake);
  }, [plan]);

  const trainingDays = intake.availability.filter((a) => a !== 'rest').length;
  const set = (patch: Partial<PlanIntake>) => setIntake((v) => ({ ...v, ...patch }));

  function cycleDay(i: number) {
    const next = [...intake.availability];
    next[i] = CYCLE[(CYCLE.indexOf(next[i]) + 1) % CYCLE.length];
    set({ availability: next });
  }

  function toggleWeakness(f: FocusArea) {
    const cur = intake.weaknesses;
    // Order carries meaning — the first is weighted highest — so a new pick goes
    // on the end rather than wherever the label list happens to put it.
    set({
      weaknesses: cur.includes(f)
        ? cur.filter((x) => x !== f)
        : [...cur, f].slice(0, 4),
    });
  }

  function toggleKit(k: string) {
    const cur = intake.equipment;
    set({ equipment: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] });
  }

  /** The query string minus the week — keeps `edit` across both steps. */
  function base(): URLSearchParams {
    const p = new URLSearchParams(window.location.search);
    PLAN_KEYS.forEach((k) => p.delete(k));
    return p;
  }

  /**
   * Puts a week in the URL. `push` is the step from questions to result;
   * `replace` is a refinement on the result (shuffle, swap a day), so the back
   * gesture returns to your answers rather than through every version.
   */
  function show(next: BuiltPlan, how: 'push' | 'replace') {
    const p = base();
    encodePlan(next).forEach((v, k) => p.set(k, v));
    const url = `?${p.toString()}`;
    setSave('idle');
    seeded.current = true;
    if (how === 'push') {
      window.history.pushState(null, '', url);
      pushed.current = true;
      window.scrollTo({ top: 0 });
    } else {
      window.history.replaceState(null, '', url);
    }
  }

  function back() {
    if (pushed.current) { pushed.current = false; window.history.back(); }
    else {
      const p = base().toString();
      window.history.replaceState(null, '', p ? `?${p}` : window.location.pathname);
    }
    window.scrollTo({ top: 0 });
  }

  async function saveWeek(week: BuiltPlan) {
    const days = planDayRows(week, '');
    // Signed out, the week is kept in this browser and saved — as the week
    // you follow — once you sign in. It used to say it "won't be here
    // tomorrow", which was true and the end of it.
    if (!signedIn) {
      pendingPlan.stash({ intake: week.intake, days, name: defaultPlanName(week.intake) });
      setSave('signin');
      return;
    }
    setSave('saving'); setError('');
    try {
      const res = await fetch('/api/plans', {
        method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editing
          ? { id: editing.id, intake: week.intake, days }
          : { intake: week.intake, days, name: defaultPlanName(week.intake) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `save failed (${res.status})`);
      }
      // To the saved week, which is where a saved week is followed from.
      router.push(editing ? `/plan?plan=${editing.id}` : '/plan');
    } catch (e) {
      setSave('error');
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  }

  if (plan) {
    const sessionsCount = plan.days.filter((d) => d.session).length;
    return (
      <div key="week" className="animate-pop">
        <div className="mt-6"><BackButton onClick={back} label="Back" destination="your answers" /></div>
        <p className="eyebrow mb-3">{editing ? `Rebuilding ${editing.name}` : 'Plan'}</p>
        <h1 className="h-hero">Your week</h1>

        {/* The week's headline numbers and its actions, on one card — the
            same arrangement as a session on Train: one primary action, and the
            refinement beside it as a glyph. */}
        <div className="mt-7 rounded-large-increased border border-brand-edge bg-surface-brand p-6 shadow-level3">
          <div className="flex items-end gap-6">
            <div>
              <div className="font-brand text-[46px] font-extrabold leading-none tracking-tightest text-on-surface-brand">
                {sessionsCount}
              </div>
              <div className="mt-1.5 text-[12.5px] font-semibold text-on-surface-brand-variant">
                session{sessionsCount === 1 ? '' : 's'} a week
              </div>
            </div>
            <div className="mb-1 flex gap-6">
              <Metric v={`${plan.totalMinutes}`} unit="min a week" />
              <Metric v={formatTouches(plan.totalTouches)} unit="touches" />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button onClick={() => saveWeek(plan)} disabled={save === 'saving' || !sessionsCount}
                    className="btn-primary pressable min-w-0 flex-1 whitespace-nowrap px-4
                               bg-on-surface-brand text-surface-brand">
              {save === 'saving' ? 'Saving…' : editing ? 'Save changes' : 'Save this week'}
            </button>
            <button onClick={() => show(buildPlan(sessions, plan.intake, Math.random()), 'replace')}
                    aria-label="Shuffle the whole week" title="Shuffle the whole week"
                    className="icon-btn pressable h-[52px] w-[52px] bg-brand-track text-on-surface-brand">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true"
                   stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {/* The swap arrows, as Another mix has on Train: the same
                    action at the scale of the whole thing. */}
                <path d="M4 8h13l-3-3M20 16H7l3 3" />
              </svg>
            </button>
          </div>

          <p role="status" className="text-[13px] font-medium text-on-surface-brand-variant">
            {save === 'signin' && (
              <span className="mt-4 block">
                <Link href="/me" className="font-bold text-on-surface-brand underline underline-offset-4">Sign in</Link> and
                this week is saved as the plan you follow.
              </span>
            )}
            {save === 'error' && <span className="mt-4 block">Couldn&rsquo;t save: {error}</span>}
          </p>
        </div>

        {!!plan.uncovered.length && (
          <p className="mt-4 rounded-large border border-outline-variant bg-surface-container-low p-3.5 text-[13px]
                        leading-relaxed text-on-surface-variant">
            Nothing in the library covers{' '}
            <strong className="text-on-surface">
              {plan.uncovered.map((f) => FOCUS_LABELS[f]).join(', ')}
            </strong>{' '}
            under these constraints. The rest of the week still targets what it can.
          </p>
        )}

        <div className="mt-6">
          <PlanWeek rows={plan.days} drillsBySession={drillsBySession}
            onSwap={(i) => show(swapPlanDay(sessions, plan, i), 'replace')} />
        </div>
      </div>
    );
  }

  return (
    <div key="questions" className="animate-pop">
      <p className="eyebrow mb-3">{editing ? `Rebuilding ${editing.name}` : 'Plan'}</p>
      <h1 className="h-hero">Weekly Schedule</h1>
      <p className="mt-3.5 max-w-[34ch] text-[15px] leading-relaxed text-on-surface-variant">
        A repeating weekly training routine built just for you.
      </p>

      <div className="mt-8">
      {/* ---- what we already knew ---- */}
      {prefill.sessionsSeen > 0 ? (
        <p className="mb-7 rounded-large-increased border border-outline-variant bg-surface-container-high p-4 text-[14px]
                      leading-relaxed text-on-surface">
          Built from your last {prefill.sessionsSeen} session
          {prefill.sessionsSeen === 1 ? '' : 's'}
          {prefill.known.weaknesses && ' — the areas you actually train'}
          {prefill.known.availability && ', on the days you actually trained'}
          {prefill.known.length && `, at about ${intake.targetMinutes} minutes`}.
          Change anything that&rsquo;s wrong.
        </p>
      ) : (
        <p className="mb-7 rounded-large-increased border border-outline-variant bg-surface-container-lowest p-4 text-[14px]
                      leading-relaxed text-on-surface-variant">
          <strong className="text-on-surface">Here&rsquo;s a starting week.</strong> Train a few
          sessions and this fills itself in from what you actually do — until then,
          change whatever doesn&rsquo;t fit.
        </p>
      )}

      {/* ---- the week ---- */}
      <h2 className="h-card">Your week</h2>
      <p className="mt-1 text-[13.5px] text-on-surface-variant">Tap a day to change what it&rsquo;s for.</p>
      <div className="mt-3.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d, i) => {
          const a = intake.availability[i];
          return (
            <button key={d} type="button" onClick={() => cycleDay(i)}
              aria-label={`${d}: ${DAY_SPOKEN[a]}. Tap to change.`}
              className={`tile pressable py-2.5 text-center ${a === 'rest' ? '' : 'tile-on'}`}>
              <span className="block font-brand text-[12px] font-bold tracking-tight">{d}</span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide">
                {DAY_LABEL[a]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---- weaknesses ---- */}
      <div className="mt-9">
        <h2 className="h-card">What to fix</h2>
        <p className="mt-1 text-[13.5px] text-on-surface-variant">
          In order — the first one gets the most time. Up to four.
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {(Object.keys(FOCUS_LABELS) as FocusArea[]).map((f) => {
            const rank = intake.weaknesses.indexOf(f);
            return (
              <button key={f} type="button" onClick={() => toggleWeakness(f)}
                className={`chip ${rank >= 0 ? 'chip-on' : ''}`}>
                {rank >= 0 && (
                  <span className="mr-1.5 font-brand text-[11px] font-bold text-primary">
                    {rank + 1}
                  </span>
                )}
                {FOCUS_LABELS[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- phase ---- */}
      <div className="mt-9">
        <h2 className="h-card">Where you are in the season</h2>
        <div className="mt-3.5 space-y-2">
          {PHASES.map(([v, title, why]) => (
            <button key={v} type="button" onClick={() => set({ seasonPhase: v, targetMinutes: undefined })}
              className={`tile pressable w-full p-3.5 text-left
                ${intake.seasonPhase === v && !intake.targetMinutes ? 'tile-on' : ''}`}>
              <span className="block text-[14.5px] font-bold text-on-surface">{title}</span>
              <span className="mt-0.5 block text-[12.5px] text-on-surface-variant">{why}</span>
            </button>
          ))}
        </div>
        {!!intake.targetMinutes && (
          <p className="mt-2.5 pl-1 text-[13px] text-on-surface-variant">
            Using {intake.targetMinutes} min from your history instead.{' '}
            <button type="button" onClick={() => set({ targetMinutes: undefined })}
              className="font-semibold text-primary underline underline-offset-2">
              Use the season instead
            </button>
          </p>
        )}
      </div>

      {/* ---- kit and constraints ---- */}
      <div className="mt-9">
        <h2 className="h-card">What you&rsquo;ve got</h2>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {KIT.map((k) => (
            <Chip key={k} on={intake.equipment.includes(k)} onClick={() => toggleKit(k)}>
              {KIT_LABEL[k] ?? k}
            </Chip>
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Chip on={intake.homeOnly} onClick={() => set({ homeOnly: !intake.homeOnly })}>
            Home only
          </Chip>
          {/* The one thing history can't tell us, so it's the one thing asked outright. */}
          <Chip on={intake.injured} onClick={() => set({ injured: !intake.injured })}>
            Carrying an injury
          </Chip>
        </div>
        {intake.injured && (
          <p className="mt-2.5 pl-1 text-[13px] text-on-surface-variant">
            Physical sessions are left out while this is on. Ball work only.
          </p>
        )}
      </div>

      {/* The moment the week is made. It used to regenerate under the
          questions on every tap, which never felt like anything had happened. */}
      <button onClick={() => show(buildPlan(sessions, intake, Math.random()), 'push')}
        disabled={trainingDays === 0}
        className="btn-primary pressable mt-10 w-full">
        Build my week
      </button>
      {trainingDays === 0 && (
        <p className="mt-3 text-center text-[13px] text-on-surface-variant">
          Every day is set to rest. Tap a day above to train on it.
        </p>
      )}
      </div>
    </div>
  );
}

function Metric({ v, unit }: { v: string; unit: string }) {
  return (
    <div>
      <div className="font-brand text-[22px] font-bold leading-none tracking-tighter text-on-surface-brand">{v}</div>
      <div className="mt-1 text-[11.5px] font-semibold text-on-surface-brand-variant">{unit}</div>
    </div>
  );
}
