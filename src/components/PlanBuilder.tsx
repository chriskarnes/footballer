'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildPlan, planDayRows, type Prefill } from '@/lib/plan-builder';
import { PlanWeek } from './PlanWeek';
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

/**
 * The blueprint screen.
 *
 * PLAN.md's one instruction for this screen is "do not open with ten questions".
 * So everything the prefill already knows is shown as a stated fact you can
 * correct, the week regenerates live as you touch anything, and the only thing
 * asked outright is the one thing history cannot reveal — whether you're injured.
 */
export function PlanBuilder({
  sessions, drillsBySession, prefill, signedIn,
}: {
  sessions: SessionRow[];
  drillsBySession: Record<string, DrillBrief[]>;
  prefill: Prefill;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [intake, setIntake] = useState<PlanIntake>(prefill.intake);
  const [seed, setSeed] = useState(0.42);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const weekRef = useRef<HTMLDivElement>(null);

  const plan: BuiltPlan = useMemo(
    () => buildPlan(sessions, intake, seed),
    [sessions, intake, seed],
  );

  const trainingDays = plan.days.filter((d) => d.kind !== 'rest').length;
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

  async function save() {
    setSaving('saving'); setError('');
    try {
      const res = await fetch('/api/plans', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intake, days: planDayRows(plan, '') }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `save failed (${res.status})`);
      }
      setSaving('saved');
      router.refresh();
    } catch (e) {
      setSaving('error');
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  }

  return (
    <div className="mt-8">
      {/* ---- what we already knew ---- */}
      {prefill.sessionsSeen > 0 ? (
        <p className="mb-7 rounded-card border border-goldUi/40 bg-goldSoft p-4 text-[14px]
                      leading-relaxed text-body">
          Built from your last {prefill.sessionsSeen} session
          {prefill.sessionsSeen === 1 ? '' : 's'}
          {prefill.known.weaknesses && ' — the areas you actually train'}
          {prefill.known.availability && ', on the days you actually trained'}
          {prefill.known.length && `, at about ${intake.targetMinutes} minutes`}.
          Change anything that&rsquo;s wrong.
        </p>
      ) : (
        <p className="mb-7 rounded-card border border-line bg-surface p-4 text-[14px]
                      leading-relaxed text-muted">
          <strong className="text-body">Here&rsquo;s a starting week.</strong> Train a few
          sessions and this fills itself in from what you actually do — until then,
          change whatever doesn&rsquo;t fit.
        </p>
      )}

      {/* ---- the week ---- */}
      <h2 className="h-card">Your week</h2>
      <p className="mt-1 text-[13.5px] text-muted">Tap a day to change what it&rsquo;s for.</p>
      <div className="mt-3.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d, i) => {
          const a = intake.availability[i];
          return (
            <button key={d} type="button" onClick={() => cycleDay(i)}
              aria-label={`${d}: ${DAY_SPOKEN[a]}. Tap to change.`}
              className={`pressable rounded-btn border-[1.5px] py-2.5 text-center transition-colors
                ${a === 'rest'
                  ? 'border-line bg-surface text-faint'
                  : 'border-ink bg-surface text-ink'}`}>
              <span className="block font-display text-[12px] font-bold tracking-tight">{d}</span>
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
        <p className="mt-1 text-[13.5px] text-muted">
          In order — the first one gets the most time. Up to four.
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {(Object.keys(FOCUS_LABELS) as FocusArea[]).map((f) => {
            const rank = intake.weaknesses.indexOf(f);
            return (
              <button key={f} type="button" onClick={() => toggleWeakness(f)}
                className={`chip ${rank >= 0 ? 'chip-on' : ''}`}>
                {rank >= 0 && (
                  <span className="mr-1.5 font-display text-[11px] font-bold text-goldText">
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
              className={`pressable block w-full rounded-btn border-[1.5px] p-3.5 text-left
                ${intake.seasonPhase === v && !intake.targetMinutes
                  ? 'border-ink bg-surface' : 'border-line bg-surface'}`}>
              <span className="block text-[14.5px] font-bold text-body">{title}</span>
              <span className="mt-0.5 block text-[12.5px] text-muted">{why}</span>
            </button>
          ))}
        </div>
        {!!intake.targetMinutes && (
          <p className="mt-2.5 pl-1 text-[13px] text-muted">
            Using ~{intake.targetMinutes} min from your history instead.{' '}
            <button type="button" onClick={() => set({ targetMinutes: undefined })}
              className="font-semibold text-goldText underline underline-offset-2">
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
            <button key={k} type="button" onClick={() => toggleKit(k)}
              className={`chip ${intake.equipment.includes(k) ? 'chip-on' : ''}`}>
              {KIT_LABEL[k] ?? k}
            </button>
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button type="button" onClick={() => set({ homeOnly: !intake.homeOnly })}
            className={`chip ${intake.homeOnly ? 'chip-on' : ''}`}>
            Home only
          </button>
          {/* The one thing history can't tell us, so it's the one thing asked outright. */}
          <button type="button" onClick={() => set({ injured: !intake.injured })}
            className={`chip ${intake.injured ? 'chip-on' : ''}`}>
            Carrying an injury
          </button>
        </div>
        {intake.injured && (
          <p className="mt-2.5 pl-1 text-[13px] text-muted">
            Physical sessions are left out while this is on. Ball work only.
          </p>
        )}
      </div>

      {/* ---- the result ---- */}
      <div ref={weekRef} className="mt-10 scroll-mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="h-card">The blueprint</h2>
          <button type="button" onClick={() => setSeed(Math.random())}
            className="text-[13px] font-semibold text-goldText underline underline-offset-4">
            Shuffle
          </button>
        </div>

        {trainingDays === 0 ? (
          <p className="card-flat mt-3.5 p-5 text-[14px] text-muted">
            Every day is set to rest. Tap a day above to train on it.
          </p>
        ) : (
          <>
            <div className="mt-3.5 flex gap-2.5">
              <Stat v={String(trainingDays)} k="sessions" />
              <Stat v={`${plan.totalMinutes}m`} k="a week" />
              <Stat v={plan.totalTouches >= 1000
                ? `${(plan.totalTouches / 1000).toFixed(1)}k` : String(plan.totalTouches)} k="touches" />
            </div>

            <PlanWeek rows={plan.days} drillsBySession={drillsBySession} />

            {!!plan.uncovered.length && (
              <p className="mt-3.5 rounded-btn border border-line bg-surface2 p-3.5 text-[13px]
                            leading-relaxed text-muted">
                Nothing in the library covers{' '}
                <strong className="text-body">
                  {plan.uncovered.map((f) => FOCUS_LABELS[f]).join(', ')}
                </strong>{' '}
                under these constraints. The rest of the week still targets what it can.
              </p>
            )}
          </>
        )}
      </div>

      {/* ---- save ---- */}
      {signedIn ? (
        <>
          <button onClick={save} disabled={saving === 'saving' || trainingDays === 0}
            className="btn-primary mt-8 w-full">
            {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved ✓' : 'Save this week'}
          </button>
          {saving === 'error' && (
            <p className="mt-3 text-center text-[13px] text-muted">{error}</p>
          )}
        </>
      ) : (
        <p className="mt-8 rounded-card border border-line bg-surface p-5 text-[14px]
                      leading-relaxed text-muted">
          <strong className="text-body">Sign in to keep this week.</strong> You can keep
          adjusting it without an account — it just won&rsquo;t be here tomorrow.
        </p>
      )}
    </div>
  );
}

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="card-flat flex-1 p-3">
      <div className="font-display text-[19px] font-bold leading-none tracking-tighter">{v}</div>
      <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-faint">{k}</div>
    </div>
  );
}
