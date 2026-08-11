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

export const FOCUS_LABELS: Record<FocusArea, string> = {
  first_touch: 'First Touch', ball_mastery: 'Ball Mastery', juggling: 'Juggling',
  dribbling: 'Dribbling', passing: 'Passing', finishing: 'Finishing',
  crossing: 'Crossing', weak_foot: 'Weak Foot', speed: 'Speed', agility: 'Agility',
  power: 'Power', strength: 'Strength', core: 'Core',
  conditioning: 'Conditioning', mobility: 'Mobility',
};

export const TOUCH_GOAL = 1000;
