/**
 * Builds one player's week from the trainer's own drills, by rules alone: no
 * AI, so it is free, instant and the same every time for the same inputs.
 * The AI pass (later) only re-ranks what this picks from; this is also what
 * runs when that is off, over budget, or fails.
 *
 *   - `sessions` sessions of about `minutes` each.
 *   - Each session leans on one of the player's focus tags, taking turns, so
 *     three tags over three sessions gives each its own day.
 *   - Drills used in the last couple of weeks drop down the list, and a drill
 *     appears once in the week while there are others to choose from.
 *   - Days come from placeDays: free days first, then practice days, never a
 *     game day.
 */
import { drillTags, placeDays, type DrillRow } from './academy-week';
import { FOCUS_LABELS, type FocusArea } from './types';

export type Target = { sessions: number; minutes: number };
export const DEFAULT_TARGET: Target = { sessions: 3, minutes: 20 };
export const MINUTE_CHOICES = [10, 15, 20, 30, 45];

export type BuiltSession = { name: string; drill_ids: string[]; weekday: number; minutes: number };

const label = (t: string) => FOCUS_LABELS[t as FocusArea] ?? t;

/** A small stable number from a string, for tie-breaks that vary by player and week. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export function buildPlayerWeek(input: {
  drills: DrillRow[];
  target: Target;
  focus: string[];
  /** Drill ids from the last couple of weeks, most recent first. */
  recent?: string[];
  busy?: { club?: number[]; game?: number | null; meets?: number[] };
  /** Varies the tie-breaks: user id + week. */
  seed?: string;
}): BuiltSession[] {
  const { target } = input;
  const pool = input.drills.filter((d) => d.minutes > 0);
  // Only tags some drill actually works on can lead a session.
  const focus = input.focus.filter((t) => pool.some((d) => drillTags(d).includes(t)));
  if (!pool.length || target.sessions < 1) return [];
  const recent = new Set(input.recent ?? []);
  const seed = input.seed ?? '';
  const used = new Map<string, number>();

  // How well a drill fits a session that leans on `lean`.
  const score = (d: DrillRow, lean: string | null) => {
    const tags = drillTags(d);
    let s = 0;
    if (lean && tags.includes(lean)) s += 6;
    s += tags.filter((t) => focus.includes(t)).length * 2;
    if (!tags.length) s -= 1;
    if (recent.has(d.id)) s -= 3;
    s -= (used.get(d.id) ?? 0) * 8;
    return s + hash(`${seed}:${d.id}`);
  };

  const days = placeDays(target.sessions, input.busy ?? {});
  const out: BuiltSession[] = [];
  for (let i = 0; i < target.sessions; i++) {
    const lean = focus.length ? focus[i % focus.length] : null;
    const ranked = [...pool].sort((a, b) => score(b, lean) - score(a, lean));
    const ids: string[] = [];
    let total = 0;
    // Fill toward the target; a couple of minutes over is fine, under isn't.
    for (const d of ranked) {
      if (ids.includes(d.id)) continue;
      if (total + d.minutes > target.minutes + 3) continue;
      ids.push(d.id); total += d.minutes;
      if (total >= target.minutes - 2) break;
    }
    // Nothing fit (every drill is longer than the target): the shortest one.
    if (!ids.length) {
      const d = [...pool].sort((a, b) => a.minutes - b.minutes)[0];
      ids.push(d.id); total = d.minutes;
    }
    for (const id of ids) used.set(id, (used.get(id) ?? 0) + 1);
    out.push({ name: nameFor(ids.map((id) => pool.find((d) => d.id === id)!), lean), drill_ids: ids, weekday: days[i], minutes: total });
  }
  // Two sessions leaning on the same tag: number them so the week reads clearly.
  const counts = new Map<string, number>();
  for (const s of out) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const s of out) if ((counts.get(s.name) ?? 0) > 1) {
    const n = (seen.get(s.name) ?? 0) + 1; seen.set(s.name, n); s.name = `${s.name} ${n}`;
  }
  return out;
}

/** Named for what it works on: its lean if a drill covers it, else its commonest tag. */
function nameFor(drills: DrillRow[], lean: string | null) {
  const tags = drills.flatMap(drillTags);
  if (lean && tags.includes(lean)) return label(lean);
  const count = new Map<string, number>();
  for (const t of tags) count.set(t, (count.get(t) ?? 0) + 1);
  const top = [...count].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] > 1 ? label(top[0]) : 'Ball work';
}

/**
 * The next-best drill to put in place of `drillId` in a session: the same
 * tags if possible, not already in the session, close in length.
 */
export function swapFor(drills: DrillRow[], session: string[], drillId: string, focus: string[], skip: string[] = []): DrillRow | null {
  const was = drills.find((d) => d.id === drillId);
  const wasTags = was ? drillTags(was) : [];
  const fresh = drills.filter((d) => d.id !== drillId && !session.includes(d.id));
  // Tapping swap again moves on rather than going back to the last one.
  const options = fresh.filter((d) => !skip.includes(d.id)).length ? fresh.filter((d) => !skip.includes(d.id)) : fresh;
  if (!options.length) return null;
  const score = (d: DrillRow) => {
    const tags = drillTags(d);
    return tags.filter((t) => wasTags.includes(t)).length * 4
      + tags.filter((t) => focus.includes(t)).length * 2
      - Math.abs(d.minutes - (was?.minutes ?? d.minutes)) / 5;
  };
  return options.sort((a, b) => score(b) - score(a))[0];
}

/** The drills worth showing the AI: the best few dozen for this player, by the same scoring the rules use. */
export function candidates(drills: DrillRow[], focus: string[], recent: string[] = [], max = 30): DrillRow[] {
  const r = new Set(recent);
  const score = (d: DrillRow) => drillTags(d).filter((t) => focus.includes(t)).length * 3 - (r.has(d.id) ? 2 : 0) + (drillTags(d).length ? 0 : -1);
  return drills.filter((d) => d.minutes > 0).sort((a, b) => score(b) - score(a)).slice(0, max);
}

export type Proposed = { name: string; drill_ids: string[]; note?: string };

/**
 * Takes sessions someone else proposed (the AI) and makes them safe to
 * publish: only real drills, each once per session, close to the target
 * length, the right number of sessions. Anything missing or broken is
 * filled from the rules' own week, so the result is always a full week.
 */
export function fitToTarget(proposed: Proposed[], fallback: BuiltSession[], drills: DrillRow[], target: Target, focus: string[]): (BuiltSession & { note?: string; fromAi: boolean })[] {
  const byId = new Map(drills.filter((d) => d.minutes > 0).map((d) => [d.id, d]));
  const mins = (ids: string[]) => ids.reduce((a, id) => a + (byId.get(id)?.minutes ?? 0), 0);
  return fallback.map((rules, i) => {
    const p = proposed[i];
    let ids = p ? [...new Set(p.drill_ids.filter((id) => byId.has(id)))] : [];
    if (!ids.length) return { ...rules, fromAi: false };
    // A drill longer than the whole session goes, if there's anything else.
    const fits = ids.filter((id) => byId.get(id)!.minutes <= target.minutes + 3);
    if (fits.length) ids = fits;
    // Too long: drop from the end. Too short: top up with the best fit not already in.
    while (ids.length > 1 && mins(ids) > target.minutes + 3) ids = ids.slice(0, -1);
    while (mins(ids) < target.minutes - 3) {
      const add = [...byId.values()].filter((d) => !ids.includes(d.id) && mins(ids) + d.minutes <= target.minutes + 3)
        .sort((a, b) => drillTags(b).filter((t) => focus.includes(t)).length - drillTags(a).filter((t) => focus.includes(t)).length)[0];
      if (!add) break;
      ids.push(add.id);
    }
    const name = (p.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || rules.name;
    const note = p.note?.replace(/\s+/g, ' ').trim().slice(0, 140) || undefined;
    return { name, drill_ids: ids, weekday: rules.weekday, minutes: mins(ids), note, fromAi: true };
  });
}
