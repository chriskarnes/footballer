import type { WorkoutRow } from '@/components/WorkoutList';

/**
 * Reading workouts for Me and its history page.
 *
 * Everything the account has, not the last 25: Me's totals were summed from a
 * 25-row list, so they stopped growing at the 26th session. A player's
 * lifetime is a few hundred small rows, well inside one request.
 */

const BASE = 'id,title,status,created_at,completed_at,planned_minutes,actual_minutes,'
  + 'planned_touches,actual_touches,source,source_ref,exercise_ids';

type Raw = {
  id: string; title: string; status: string; created_at: string; completed_at: string | null;
  planned_minutes: number | string | null; actual_minutes: number | string | null;
  planned_touches: number | null; actual_touches: number | null;
  source: string | null; source_ref: string | null; exercise_ids: string[] | null;
  workout_items?: { done: boolean | null }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readWorkouts(db: any): Promise<Raw[]> {
  // The ticked drills come from workout_items. If that embed isn't available
  // the rows still come back, just without partial sessions marked.
  const full = await db.from('workouts').select(`${BASE},workout_items(done)`)
    .order('created_at', { ascending: false }).limit(1000);
  if (!full.error) return full.data ?? [];
  const bare = await db.from('workouts').select(BASE)
    .order('created_at', { ascending: false }).limit(1000);
  return bare.data ?? [];
}

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export function toRow(w: Raw): WorkoutRow {
  const done = w.status === 'completed';
  const drills = w.exercise_ids?.length || w.workout_items?.length || 0;
  const ticked = (w.workout_items ?? []).filter((i) => i.done).length;
  return {
    id: w.id,
    title: w.title,
    done,
    at: (done ? w.completed_at : null) ?? w.created_at,
    minutes: done ? num(w.actual_minutes ?? w.planned_minutes) : num(w.planned_minutes),
    touches: done ? num(w.actual_touches ?? w.planned_touches) : num(w.planned_touches),
    drills,
    // Nothing ticked on a finished session means it predates the runner
    // recording ticks — it was finished whole, which was the only way then.
    ticked: done && ticked === 0 ? drills : ticked,
  };
}

/** Finished sessions, newest first. */
export const finishedRows = (all: Raw[]) =>
  all.filter((w) => w.status === 'completed').map(toRow)
    .sort((a, b) => b.at.localeCompare(a.at));

export type { Raw as WorkoutRaw };
