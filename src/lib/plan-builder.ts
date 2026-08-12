/**
 * Weekly blueprint generation.
 *
 * Framework-free for the same reason as session-builder.ts — no React, no Next,
 * no network — so the React Native app can import it unchanged.
 *
 * The unit here is a LIBRARY SESSION, not a generated drill list. That is not a
 * shortcut: plan_days.session_id is a foreign key onto sessions(id) in
 * schema.sql, so a plan can only ever point at a session that really exists.
 * Train Now generates; the blueprint prescribes.
 */
import type {
  Availability, BuiltPlan, DayKind, FocusArea, PlanIntake, PlannedDay, SessionRow,
} from './types';
import { PHYSICAL_FOCUS, TECHNICAL_FOCUS } from './types';

/**
 * Target minutes per session by season phase. Off-season is when you can
 * actually put volume in; in-season the sessions get short because matches are
 * the priority and a flattened player is worse than an untrained one.
 */
const PHASE_MINUTES: Record<PlanIntake['seasonPhase'], number> = {
  off: 45,
  pre: 35,
  in: 25,
};

/** How far over the target we will still accept, before it stops being that day. */
const LENGTH_TOLERANCE = 1.5;

/**
 * Weakness weighting, with diminishing returns per weakness across the week.
 *
 * Rank alone (1, ½, ⅓…) is too blunt: the top weakness outscores everything in
 * every slot, so a player who names three gets a week that drills one and never
 * mentions the other two. Dividing by how often a weakness has already been
 * booked keeps the first one ahead early, then lets the second and third win
 * slots once it has been served. Ordering still decides who gets there first.
 */
function weaknessScore(
  session: SessionRow,
  weaknesses: FocusArea[],
  coverage: Map<FocusArea, number>,
): number {
  let score = 0;
  weaknesses.forEach((w, i) => {
    if (!session.focus_areas.includes(w)) return;
    score += (1 / (i + 1)) / (1 + (coverage.get(w) ?? 0));
  });
  return score;
}

const isTechnical = (s: SessionRow) => s.focus_areas.some((f) => TECHNICAL_FOCUS.includes(f));
const isPhysical = (s: SessionRow) => s.focus_areas.some((f) => PHYSICAL_FOCUS.includes(f));

/**
 * Whether a session is allowed at all, before we start ranking. Anything that
 * fails here is not a worse choice — it is not a choice.
 */
function eligible(s: SessionRow, intake: PlanIntake, kind: DayKind): boolean {
  if (kind === 'technical' && !isTechnical(s)) return false;
  if (kind === 'physical' && !isPhysical(s)) return false;
  if (intake.homeOnly && !s.can_do_at_home) return false;

  // Equipment is a promise the plan makes for a whole week — a session needing a
  // goal is useless to someone with a ball and a wall, however well it scores.
  // 'none' is not kit, so it never needs to be owned.
  const kit = new Set([...intake.equipment, 'none']);
  if (!s.equipment.every((e) => kit.has(e))) return false;

  // Injured: physical work is where the re-injury risk lives, so drop it wholesale
  // and let the week run on ball skills.
  if (intake.injured && isPhysical(s) && !isTechnical(s)) return false;

  return true;
}

/**
 * Ranking. Weakness fit dominates; length fit is the tie-break, because a
 * perfectly-targeted 70-minute session on a 25-minute in-season day is not
 * going to get done.
 */
/**
 * How much of a session actually belongs to the day's kind.
 *
 * Eligibility only asks whether ANY focus area matches, which is deliberately
 * loose so a thin-kit week can still be filled. But "Tight Ball Control" is
 * tagged agility alongside three ball skills, and prescribing it on a physical
 * day reads as a mistake even though it passes. Ranking on the share, not the
 * presence, puts the genuinely physical sessions on the physical days and keeps
 * the loose ones as fallback.
 */
function kindFit(s: SessionRow, kind: DayKind): number {
  if (kind === 'rest' || !s.focus_areas.length) return 0;
  const wanted = kind === 'technical' ? TECHNICAL_FOCUS : PHYSICAL_FOCUS;
  return s.focus_areas.filter((f) => wanted.includes(f)).length / s.focus_areas.length;
}

function score(
  s: SessionRow, intake: PlanIntake, target: number,
  coverage: Map<FocusArea, number>, kind: DayKind,
): number {
  const fit = weaknessScore(s, intake.weaknesses, coverage);
  const overshoot = Math.abs(s.total_minutes - target) / target;
  const touchBonus = s.hits_touch_goal ? 0.15 : 0;
  return fit * 3 + kindFit(s, kind) * 1.5 - overshoot + touchBonus;
}

/**
 * Expand the 7 availability answers into the day slots a week actually has.
 *
 * Injury converts physical days to ball work rather than merely filtering the
 * worst sessions out of them. Excluding only *pure* physical sessions still let
 * an agility session through on the strength of one technical tag, which is the
 * exact thing that re-injures someone — and it made the screen's promise of
 * "ball work only" a lie.
 */
function slotsFor(
  availability: Availability[], injured: boolean,
): { weekday: number; slot: number; kind: DayKind }[] {
  const out: { weekday: number; slot: number; kind: DayKind }[] = [];
  const physical: DayKind = injured ? 'technical' : 'physical';
  availability.forEach((a, weekday) => {
    if (a === 'rest') {
      out.push({ weekday, slot: 0, kind: 'rest' });
    } else if (a === 'both') {
      // Technical first: it is the one that suffers when you are already tired.
      out.push({ weekday, slot: 0, kind: 'technical' });
      out.push({ weekday, slot: 1, kind: physical });
    } else {
      out.push({ weekday, slot: 0, kind: a === 'physical' ? physical : a });
    }
  });
  return out;
}

/** Never includes the duration — every caller renders that itself, and having it
 *  here produced "36 min · 36 min · Dribbling". */
function reasonFor(s: SessionRow, intake: PlanIntake): string {
  const hit = intake.weaknesses.filter((w) => s.focus_areas.includes(w));
  if (hit.length) return `Targets ${hit.slice(0, 2).map(label).join(' and ')}`;
  return s.focus_areas.slice(0, 2).map(label).join(', ');
}

// Local rather than imported from types.ts to keep this file's imports to types
// only — FOCUS_LABELS is a UI concern that happens to live in the same module.
function label(f: FocusArea): string {
  return f.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Build the week.
 *
 * Sessions are not repeated within a week while there is anything else eligible —
 * a blueprint that prescribes the same session three times reads as broken even
 * when the selection is defensible. Once the eligible pool is exhausted we do
 * allow repeats rather than leaving a training day empty, because a day with
 * nothing on it is worse than a day you have seen before.
 */
export function buildPlan(
  sessions: SessionRow[],
  intake: PlanIntake,
  seed = Math.random(),
): BuiltPlan {
  const target = intake.targetMinutes ?? PHASE_MINUTES[intake.seasonPhase];
  const slots = slotsFor(intake.availability, intake.injured);

  // Same deterministic jitter as session-builder, so "shuffle" varies without
  // being random on every render.
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;

  const used = new Set<string>();
  // How many times each weakness has been booked so far this week. Feeds the
  // diminishing-returns term so later slots spread onto the other weaknesses.
  const coverage = new Map<FocusArea, number>();
  const days: PlannedDay[] = [];

  for (const slot of slots) {
    if (slot.kind === 'rest') {
      days.push({ ...slot, session: null, reason: 'Rest' });
      continue;
    }

    const pool = sessions.filter((x) => eligible(x, intake, slot.kind));
    const fresh = pool.filter((x) => !used.has(x.id));
    const from = fresh.length ? fresh : pool;

    if (!from.length) {
      // Nothing in the library can serve this day under these constraints. Say so
      // rather than silently turning it into a rest day.
      days.push({ ...slot, session: null, reason: 'Nothing in the library fits this day' });
      continue;
    }

    const best = from
      .map((x) => [score(x, intake, target, coverage, slot.kind) + rnd() * 0.15, x] as const)
      .sort((a, b) => b[0] - a[0])[0][1];

    used.add(best.id);
    intake.weaknesses.forEach((w) => {
      if (best.focus_areas.includes(w)) coverage.set(w, (coverage.get(w) ?? 0) + 1);
    });
    days.push({ ...slot, session: best, reason: reasonFor(best, intake) });
  }

  const chosen = days.map((d) => d.session).filter((x): x is SessionRow => !!x);
  const covered = new Set(chosen.flatMap((x) => x.focus_areas));

  return {
    intake,
    days,
    totalMinutes: Math.round(chosen.reduce((a, x) => a + x.total_minutes, 0)),
    totalTouches: chosen.reduce((a, x) => a + x.touches, 0),
    uncovered: intake.weaknesses.filter((w) => !covered.has(w)),
  };
}

/* ---- prefill ------------------------------------------------------------ */

/** The shape we need off a workouts row. Loose on purpose — this reads history
 *  written by earlier versions of the app, so every field is treated as absent
 *  until proven otherwise. */
export interface HistoryRow {
  created_at?: string | null;
  planned_minutes?: number | string | null;
  actual_minutes?: number | string | null;
  spec?: { focus?: FocusArea[]; minutes?: number } | null;
  status?: string | null;
}

export interface ProfileRow {
  level?: string | null;
  equipment?: string[] | null;
  home_only?: boolean | null;
  season_phase?: string | null;
  weaknesses?: string[] | null;
}

/** What we already know, and therefore do not have to ask. */
export interface Prefill {
  intake: PlanIntake;
  /** Which fields came from real evidence, so the UI can show its working and
   *  ask only about the rest. */
  known: Record<'weaknesses' | 'availability' | 'length' | 'equipment' | 'level', boolean>;
  sessionsSeen: number;
}

const DEFAULT_EQUIPMENT = ['ball'];

/**
 * The week we suggest when there is no history to read — four days, ball work
 * three of them, and the weekend left clear because that is when matches are.
 * A first-time visitor should land on a plausible week to edit, not seven rest
 * days and a blank screen; /plan is a tab, so people arrive here cold.
 */
const STARTER_WEEK: Availability[] = [
  'technical', 'physical', 'technical', 'rest', 'technical', 'rest', 'rest',
];

/**
 * Derive an intake from a profile plus training history, in PLAN.md's stated
 * order: profile first, then what they have actually done, then defaults. The
 * point is that a player who has trained a few times should open this screen and
 * find it already answered.
 */
export function derivePrefill(
  history: HistoryRow[],
  profile: ProfileRow | null,
  today = 0,
): Prefill {
  const done = history.filter((h) => h.status === 'completed' || h.status === 'planned');

  // Weaknesses: what they actually train, most frequent first. Their own profile
  // wins if they have set it, because that is a stated intention rather than a
  // revealed habit.
  const tally = new Map<FocusArea, number>();
  done.forEach((h) => (h.spec?.focus ?? []).forEach((f) =>
    tally.set(f, (tally.get(f) ?? 0) + 1)));
  const fromHistory = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  const fromProfile = (profile?.weaknesses ?? []).filter(Boolean) as FocusArea[];
  const weaknesses = (fromProfile.length ? fromProfile : fromHistory).slice(0, 3);

  // Length: median rather than mean, so one 60-minute Sunday doesn't move it.
  const lengths = done
    .map((h) => Number(h.actual_minutes ?? h.planned_minutes ?? h.spec?.minutes ?? 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0;

  // Availability: the weekdays they have actually trained on become training
  // days. Everything else starts as rest, which is the honest default — better
  // to under-promise a week they'll keep than fill seven days they won't.
  const trained = new Set<number>();
  done.forEach((h) => {
    if (!h.created_at) return;
    const d = new Date(h.created_at);
    if (Number.isNaN(d.getTime())) return;
    trained.add((d.getDay() + 6) % 7);          // JS Sunday=0 → our Monday=0
  });
  const availability: Availability[] = trained.size
    ? Array.from({ length: 7 }, (_, i) => (trained.has(i) ? 'technical' : 'rest'))
    : [...STARTER_WEEK];

  const phase = (['off', 'pre', 'in'] as const)
    .find((p) => p === profile?.season_phase) ?? 'pre';

  return {
    intake: {
      availability,
      weaknesses,
      seasonPhase: phase,
      equipment: profile?.equipment?.length ? profile.equipment : DEFAULT_EQUIPMENT,
      homeOnly: !!profile?.home_only,
      injured: false,                            // never inferred — always asked
      level: profile?.level || 'any',
      targetMinutes: median || undefined,
    },
    known: {
      weaknesses: weaknesses.length > 0,
      availability: trained.size > 0,
      length: median > 0,
      equipment: !!profile?.equipment?.length,
      level: !!profile?.level,
    },
    sessionsSeen: done.length,
  };
}

/** Rows for plan_days, in insert order. Rest days are stored too — an explicit
 *  rest day is a decision, and losing it would make the week ambiguous. */
export function planDayRows(plan: BuiltPlan, planId: string) {
  return plan.days.map((d) => ({
    plan_id: planId,
    weekday: d.weekday,
    slot: d.slot,
    kind: d.kind,
    session_id: d.session?.id ?? null,
  }));
}
