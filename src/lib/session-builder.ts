/**
 * Drill selection. Deliberately framework-free — no React, no Next, no network —
 * so a React Native app can import this file unchanged.
 *
 * The AI never picks drills. It turns free text into a SessionSpec; this code
 * does the selection. That keeps results deterministic, fast, cheap, and makes
 * it impossible for the model to invent a drill that isn't in the library.
 */
import type { BuiltSession, Exercise, FocusArea, SessionSpec } from './types';
import { TOUCH_GOAL } from './types';

const ORDER = { low: 0, moderate: 1, high: 2 } as const;

function fits(d: Exercise, spec: SessionSpec): boolean {
  if (!spec.focus.some((f) => d.focus_areas.includes(f))) return false;
  if (spec.place === 'home' && !d.can_do_at_home) return false;
  if (spec.place === 'pitch' &&
      !(d.equipment.includes('goal') || d.space_required === 'half_pitch' || d.space_required === 'full_pitch'))
    return false;
  if (spec.place === 'gym' && !d.gym_required) return false;
  if (spec.level !== 'any' && d.level !== spec.level) return false;
  if (d.total_seconds < 20) return false;
  if (d.total_seconds > spec.minutes * 60 * 1.05) return false;
  if (spec.priority === 'touches' && !d.touches) return false;   // no ball, no touches
  return true;
}

/** Technical work fresh, high intensity in the middle, core and strength last. */
function sequence(a: Exercise, b: Exercise): number {
  const rank = (d: Exercise) =>
    d.primary_focus === 'core' || d.primary_focus === 'strength' ? 3 : ORDER[d.intensity];
  return rank(a) - rank(b);
}

export function buildSession(all: Exercise[], spec: SessionSpec, seed = Math.random()): BuiltSession {
  const pool = all.filter((d) => fits(d, spec));
  const budget = spec.minutes * 60;
  if (!pool.length) {
    return { spec, drills: [], rounds: 1, totalSeconds: 0, totalTouches: 0, poolSize: 0 };
  }

  // deterministic-ish jitter so "another mix" varies without being random per render
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;

  // one bucket per requested focus, so a two-focus session contains both
  const buckets = spec.focus.map((f) => {
    const b = pool.filter((d) => d.focus_areas.includes(f));
    return spec.priority === 'touches'
      ? b.map((d) => [-d.touches_per_min * (0.85 + rnd() * 0.3), d] as const)
         .sort((x, y) => x[0] - y[0]).map(([, d]) => d)
      : b.map((d) => [rnd(), d] as const).sort((x, y) => x[0] - y[0]).map(([, d]) => d);
  });

  const maxDrills = spec.priority === 'touches'
    ? Math.max(4, Math.min(16, Math.round(spec.minutes / 2.2)))
    : Math.max(3, Math.min(12, Math.round(spec.minutes / 4)));

  const picked: Exercise[] = [];
  const seen = new Set<string>();
  const seenProgram = new Set<string>();
  let used = 0;

  for (const pass of [1, 2]) {
    let progress = true;
    while (progress && picked.length < maxDrills && used <= budget * 0.94) {
      progress = false;
      for (const bucket of buckets) {
        if (picked.length >= maxDrills || used > budget * 0.94) break;
        const d = bucket.find(
          (x) => !seen.has(x.id) && used + x.total_seconds <= budget &&
                 (pass > 1 || !seenProgram.has(x.program_id))
        );
        if (d) {
          picked.push(d); seen.add(d.id); seenProgram.add(d.program_id);
          used += d.total_seconds; progress = true;
        }
      }
    }
    if (used > budget * 0.94 || picked.length >= maxDrills) break;
  }

  picked.sort(sequence);

  // short circuits (core, ball mastery) leave time over — repeat rather than pile on drills
  let rounds = 1;
  if (used > 0 && used < budget * 0.6) rounds = Math.max(1, Math.floor(budget / used));

  return {
    spec,
    drills: picked,
    rounds,
    totalSeconds: used * rounds,
    totalTouches: picked.reduce((a, d) => a + d.touches, 0) * rounds,
    poolSize: pool.length,
  };
}

/** Swap one drill for another that still fits the remaining budget. */
export function swapDrill(all: Exercise[], built: BuiltSession, index: number): BuiltSession {
  const others = built.drills.reduce((a, d, i) => (i === index ? a : a + d.total_seconds), 0);
  const room = built.spec.minutes * 60 - others;
  const chosen = new Set(built.drills.map((d) => d.id));
  let candidates = all.filter(
    (d) => fits(d, built.spec) && !chosen.has(d.id) && d.total_seconds <= room
  );
  if (!candidates.length) return built;
  if (built.spec.priority === 'touches') {
    candidates = candidates.sort((a, b) => b.touches_per_min - a.touches_per_min)
      .slice(0, Math.max(3, Math.ceil(candidates.length * 0.3)));
  }
  const next = [...built.drills];
  next[index] = candidates[Math.floor(Math.random() * candidates.length)];
  const used = next.reduce((a, d) => a + d.total_seconds, 0);
  return {
    ...built,
    drills: next,
    totalSeconds: used * built.rounds,
    totalTouches: next.reduce((a, d) => a + d.touches, 0) * built.rounds,
  };
}

export const roundTouches = (n: number): number => {
  n = Math.round(n);
  if (n <= 0) return 0;
  const step = n < 50 ? 10 : n < 100 ? 25 : n < 1000 ? 50 : 100;
  return Math.max(step, Math.round(n / step) * step);
};

export const formatTouches = (n: number): string => {
  const v = roundTouches(n);
  if (v <= 0) return '0';
  return '~' + (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : v);
};

export const hitsGoal = (touches: number) => touches >= TOUCH_GOAL;
