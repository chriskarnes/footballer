/**
 * A built session, written into a query string and read back out.
 *
 * Coach sessions have no id until they're saved, and saving is something the
 * player chooses — so the URL carries the session itself. That is what lets the
 * result step on Train survive a refresh and the back gesture, and what lets the
 * runner open a session nobody has saved.
 *
 * The drill ids are stored, not the seed: the same ids always give the same
 * session, even after a swap or after the library changes underneath it. A drill
 * that has since disappeared is simply dropped.
 *
 * Framework-free, like session-builder, so it can be shared with a native app.
 */
import type { BuiltSession, Exercise, FocusArea, Place, Priority, SessionSpec } from './types';
import { FOCUS_LABELS } from './types';

/** `.` because URLSearchParams leaves it alone — a comma becomes %2C. */
const SEP = '.';

export function encodeSession(built: BuiltSession, anyFocus = false): string {
  const p = new URLSearchParams();
  p.set('m', String(built.spec.minutes));
  p.set('f', built.spec.focus.join(SEP));
  if (built.spec.place !== 'any') p.set('p', built.spec.place);
  if (built.spec.level !== 'any') p.set('l', built.spec.level);
  if (built.spec.priority !== 'touches') p.set('pr', built.spec.priority);
  if (built.rounds > 1) p.set('r', String(built.rounds));
  // Remembers that the player said "Anything", so Another mix after a refresh
  // still draws new focus areas instead of locking in the three it drew last.
  if (anyFocus) p.set('a', '1');
  p.set('d', built.drills.map((d) => d.id).join(SEP));
  return p.toString();
}

type Params = { get(name: string): string | null };

/** Null when the params don't describe a session — that's the inputs step. */
export function decodeSession(
  params: Params, all: Exercise[],
): { built: BuiltSession; anyFocus: boolean } | null {
  const ids = params.get('d');
  const minutes = Number(params.get('m'));
  if (!ids || !minutes) return null;

  const byId = new Map(all.map((e) => [e.id, e]));
  const drills = ids.split(SEP).map((id) => byId.get(id)).filter(Boolean) as Exercise[];
  if (!drills.length) return null;

  const focus = (params.get('f') ?? '').split(SEP)
    .filter((f): f is FocusArea => f in FOCUS_LABELS);
  const spec: SessionSpec = {
    minutes,
    focus: focus.length ? focus : [...new Set(drills.map((d) => d.primary_focus))],
    place: (params.get('p') as Place | null) ?? 'any',
    level: params.get('l') ?? 'any',
    priority: (params.get('pr') as Priority | null) ?? 'touches',
  };
  const rounds = Math.max(1, Number(params.get('r')) || 1);
  return {
    built: {
      spec, drills, rounds,
      totalSeconds: drills.reduce((a, d) => a + d.total_seconds, 0) * rounds,
      totalTouches: drills.reduce((a, d) => a + d.touches, 0) * rounds,
      poolSize: 0,
    },
    anyFocus: params.get('a') === '1',
  };
}

/** One name for a coach session, used when it's saved and when it's run. */
export const sessionTitle = (spec: SessionSpec) =>
  `${spec.minutes}-min ${spec.focus.map((f) => FOCUS_LABELS[f]).join(' + ')}`;
