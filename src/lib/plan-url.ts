/**
 * A built week, written into a query string and read back out — the plan's
 * version of session-url.ts, for the same reasons: the result step survives a
 * refresh and the back gesture, and an unsaved week can't be lost by both.
 *
 * The answers and the chosen session ids are stored, not the shuffle seed, so a
 * week with a swapped Tuesday comes back with that Tuesday.
 *
 * Framework-free, like plan-builder.
 */
import type { Availability, BuiltPlan, FocusArea, PlanIntake, SessionRow } from './types';
import { FOCUS_LABELS } from './types';
import { planFromIds } from './plan-builder';

const SEP = '.';
const DAY_CODE: Record<Availability, string> = { rest: 'r', technical: 't', physical: 'p', both: 'b' };
const CODE_DAY: Record<string, Availability> = { r: 'rest', t: 'technical', p: 'physical', b: 'both' };
/** No session for a day that has nothing to fit it. */
const NONE = '-';

/** The params that mean "this is the result step". Callers keep anything else. */
export const PLAN_KEYS = ['a', 'w', 'ph', 'tm', 'k', 'h', 'i', 'l', 's'];

export function encodePlan(plan: BuiltPlan): URLSearchParams {
  const { intake } = plan;
  const p = new URLSearchParams();
  p.set('a', intake.availability.map((a) => DAY_CODE[a]).join(''));
  if (intake.weaknesses.length) p.set('w', intake.weaknesses.join(SEP));
  p.set('ph', intake.seasonPhase);
  if (intake.targetMinutes) p.set('tm', String(intake.targetMinutes));
  if (intake.equipment.length) p.set('k', intake.equipment.join(SEP));
  if (intake.homeOnly) p.set('h', '1');
  if (intake.injured) p.set('i', '1');
  if (intake.level && intake.level !== 'any') p.set('l', intake.level);
  p.set('s', plan.days.filter((d) => d.kind !== 'rest').map((d) => d.session?.id ?? NONE).join(SEP));
  return p;
}

type Params = { get(name: string): string | null };

/** Null when the params don't describe a week — that's the questions step. */
export function decodePlan(params: Params, sessions: SessionRow[]): BuiltPlan | null {
  const a = params.get('a');
  const s = params.get('s');
  if (!a || a.length !== 7 || s === null) return null;
  const availability = [...a].map((c) => CODE_DAY[c]);
  if (availability.some((x) => !x)) return null;

  const phase = params.get('ph');
  const intake: PlanIntake = {
    availability,
    weaknesses: (params.get('w') ?? '').split(SEP).filter((f): f is FocusArea => f in FOCUS_LABELS),
    seasonPhase: phase === 'off' || phase === 'in' ? phase : 'pre',
    equipment: (params.get('k') ?? '').split(SEP).filter(Boolean),
    homeOnly: params.get('h') === '1',
    injured: params.get('i') === '1',
    level: params.get('l') ?? 'any',
    targetMinutes: Number(params.get('tm')) || undefined,
  };
  const ids = s.split(SEP).map((id) => (id && id !== NONE ? id : null));
  return planFromIds(sessions, intake, ids);
}
