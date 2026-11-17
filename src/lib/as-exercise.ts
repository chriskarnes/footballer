import type { DrillRow } from './academy-week';
import type { Exercise } from './types';
import { progressAmount } from './week-builder';

/** A trainer's drill, as the session runner takes it: its amount at this week's step, its steps as lines. */
export function asExercise(d: DrillRow, sessionId: string, i: number, step = 0): Exercise {
  const amount = progressAmount(d.amount, step);
  return {
    id: `${d.id}:${i}`, session_id: sessionId, program_id: '', name: d.name, exercise_order: i,
    sets: '', reps_time: amount ?? '', rest: '', total_seconds: d.minutes * 60, work_seconds: d.minutes * 60,
    total_minutes: d.minutes, touches: 0, touches_per_min: 0, primary_focus: (d.focus ?? 'ball_mastery') as Exercise['primary_focus'],
    focus_areas: [], equipment: [], intensity: 'moderate', space_required: 'minimal', can_do_at_home: true,
    gym_required: false, level: '', category: '', video_url: d.video_url, duration_confidence: 'high',
    amount: amount ?? `${d.minutes} min`,
    how: d.how ? d.how.split('\n').map((l) => l.trim()).filter(Boolean) : undefined,
  };
}
