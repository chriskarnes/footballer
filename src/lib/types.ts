export type FocusArea =
  | 'first_touch' | 'ball_mastery' | 'juggling' | 'dribbling' | 'passing'
  | 'finishing' | 'crossing' | 'weak_foot' | 'speed' | 'agility'
  | 'power' | 'strength' | 'core' | 'conditioning' | 'mobility';

export type Place = 'any' | 'home' | 'pitch' | 'gym';
export type Priority = 'touches' | 'balanced';

export interface Exercise {
  id: string;
  session_id: string;
  program_id: string;
  name: string;
  exercise_order: number;
  sets: string;
  reps_time: string;
  rest: string;
  total_seconds: number;
  work_seconds: number;
  total_minutes: number;
  touches: number;
  touches_per_min: number;
  primary_focus: FocusArea;
  focus_areas: FocusArea[];
  equipment: string[];
  intensity: 'low' | 'moderate' | 'high';
  space_required: 'minimal' | 'small_area' | 'half_pitch' | 'full_pitch';
  can_do_at_home: boolean;
  gym_required: boolean;
  level: string;
  category: string;
  video_url: string | null;
  duration_confidence: 'high' | 'medium' | 'low';
}

export interface SessionRow {
  id: string;
  program_id: string;
  name: string;
  session_number: number;
  total_minutes: number;
  touches: number;
  hits_touch_goal: boolean;
  focus_areas: FocusArea[];
  can_do_at_home: boolean;
  equipment: string[];
  sort_order: number;
}

export interface Program {
  id: string;
  name: string;
  category: string;
  kid_name: string | null;
  level: string;
  goal: string | null;
  graduation: string | null;
  total_minutes: number;
  touches: number;
}

/** What the coach turns free text into. The model fills this; code does the picking. */
export interface SessionSpec {
  minutes: number;
  focus: FocusArea[];
  place: Place;
  level: string;         // 'any' | Beginner | Advanced | Elite
  priority: Priority;
}

export interface BuiltSession {
  spec: SessionSpec;
  drills: Exercise[];
  rounds: number;
  totalSeconds: number;
  totalTouches: number;
  poolSize: number;
}

/* ---- the weekly blueprint ---------------------------------------------- */

/**
 * How a given weekday is spent. Mirrors plan_days.kind in schema.sql, except
 * for 'both', which is an intake answer rather than a stored row: a "both" day
 * is written as two plan_days rows at slot 0 and slot 1.
 */
export type DayKind = 'rest' | 'technical' | 'physical';
export type Availability = DayKind | 'both';

/**
 * Drives session length. Volume comes down as matches start mattering more —
 * nobody wants their legs emptied the day before a game.
 */
export type SeasonPhase = 'off' | 'pre' | 'in';

/** 0 = Monday, matching the check constraint on plan_days.weekday. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** The answers. Stored verbatim in plans.intake so a plan can be rebuilt later. */
export interface PlanIntake {
  availability: Availability[];   // exactly 7, index 0 = Monday
  weaknesses: FocusArea[];        // ordered — the first is weighted highest
  seasonPhase: SeasonPhase;
  equipment: string[];
  homeOnly: boolean;
  injured: boolean;               // excludes high-intensity work
  level: string;                  // 'any' | Beginner | Advanced | Elite
  /**
   * Overrides the season phase's default length. Set from history when we know
   * what they actually train for — PLAN.md wants phase to drive length, but a
   * player whose sessions are all 20 minutes should not be handed 45 because
   * it happens to be the off-season.
   */
  targetMinutes?: number;
}

/** One row of the generated week. `session` is null on a rest day. */
export interface PlannedDay {
  weekday: number;                // 0-6, Monday first
  slot: number;                   // 0 or 1 — 1 only exists on a "both" day
  kind: DayKind;
  session: SessionRow | null;
  /** Why this session was chosen, shown in the UI rather than hidden. */
  reason: string;
}

export interface BuiltPlan {
  intake: PlanIntake;
  days: PlannedDay[];
  totalMinutes: number;
  totalTouches: number;
  /** Weaknesses the library simply could not cover, so the UI can be honest. */
  uncovered: FocusArea[];
}

/**
 * Just enough of an Exercise to list a day's drills.
 *
 * The full library is 471KB and the blueprint only needs four fields per drill,
 * so the plan screen ships this instead. Train Now still gets whole Exercises
 * because it has to run the selection algorithm client-side; here the sessions
 * are already chosen.
 */
export interface DrillBrief {
  id: string;
  name: string;
  sets: string;
  reps_time: string;
  total_seconds: number;
}

/** Ball skills vs athletic work. The split behind `kind`. */
export const TECHNICAL_FOCUS: FocusArea[] = [
  'first_touch', 'ball_mastery', 'juggling', 'dribbling',
  'passing', 'finishing', 'crossing', 'weak_foot',
];
export const PHYSICAL_FOCUS: FocusArea[] = [
  'speed', 'agility', 'power', 'strength', 'core', 'conditioning', 'mobility',
];

export const FOCUS_LABELS: Record<FocusArea, string> = {
  first_touch: 'First Touch', ball_mastery: 'Ball Mastery', juggling: 'Juggling',
  dribbling: 'Dribbling', passing: 'Passing', finishing: 'Finishing',
  crossing: 'Crossing', weak_foot: 'Weak Foot', speed: 'Speed', agility: 'Agility',
  power: 'Power', strength: 'Strength', core: 'Core',
  conditioning: 'Conditioning', mobility: 'Mobility',
};

export const TOUCH_GOAL = 1000;
