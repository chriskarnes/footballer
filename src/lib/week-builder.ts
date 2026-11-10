/**
 * Builds one player's week from the trainer's own drills, by rules alone: no
 * AI, so it is free, instant and the same every time for the same inputs.
 * The AI pass may swap the new drills and write the notes; what steps up,
 * holds or eases off is decided here, every time.
 *
 * The week:
 *   - `sessions` sessions of about `minutes` each.
 *   - Each session leans on one of the player's focus tags, taking turns.
 *   - Days come from placeDays: free days first, then practice days, never a
 *     game day.
 *
 * Progression, from what came of the last built week:
 *   - Core and new. Each session keeps up to two drills from last week for its
 *     focus (repetition is how a skill sticks) and fills the rest with new
 *     ones (variety keeps it fresh).
 *   - Step up. A kept drill that was done, and didn't feel too hard, goes up a
 *     step: more reps or longer (progressAmount). Past the last step it hands
 *     over to its harder version, if the trainer named one.
 *   - Hold. Felt hard, or wasn't done: same step again.
 *   - Ease off. Under half of last week done: nothing steps up, and the week
 *     leans on drills they already know.
 *   - Lighter week. After three built weeks in a row, the fourth is shorter
 *     and familiar, with no step-ups, before the next block.
 */
import { drillTags, placeDays, type DrillRow } from './academy-week';
import { FOCUS_LABELS, type FocusArea } from './types';

export type Target = { sessions: number; minutes: number };
/** Sessions are 30 minutes to an hour: long enough to work, short enough to finish. */
export const MIN_MINUTES = 30;
export const MAX_MINUTES = 60;
export const DEFAULT_TARGET: Target = { sessions: 3, minutes: 45 };
export const MINUTE_CHOICES = [30, 45, 60];
/** A saved length from before the 30–60 range, brought inside it. */
export const sessionMinutes = (n: number) => Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, n));
/** Steps a drill can go up before it needs its harder version. */
export const MAX_STEP = 3;
/** A lighter week after this many built weeks in a row. */
export const BLOCK = 3;
const LIGHT = 0.65;

export type Feel = 'easy' | 'right' | 'hard';
/** What happened to a drill this week, against last. */
export type Change = 'new' | 'same' | 'up' | 'harder' | 'hold';

/** A week built before, and what came of each session. */
export type PastWeek = {
  week_of: string; light: boolean;
  sessions: { drill_ids: string[]; steps: number[]; done: boolean; feel: Feel | null; ticked: string[] | null }[];
};

export type BuiltSession = {
  name: string; drill_ids: string[]; steps: number[]; changes: Change[];
  weekday: number; minutes: number; light: boolean;
};

export type DrillWithHarder = DrillRow;

const label = (t: string) => FOCUS_LABELS[t as FocusArea] ?? t;

/** A small stable number from a string, for tie-breaks that vary by player and week. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const minusWeek = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10);

/** Built weeks in a row, not counting a lighter one, just before `weekOf`. */
export function blockRun(weekOf: string, history: PastWeek[]) {
  let n = 0, expect = minusWeek(weekOf);
  for (const w of history) {
    if (w.week_of !== expect || w.light) break;
    n++; expect = minusWeek(expect);
  }
  return n;
}

export function buildPlayerWeek(input: {
  drills: DrillWithHarder[];
  target: Target;
  focus: string[];
  /** Drill ids from the last couple of weeks, most recent first. */
  recent?: string[];
  busy?: { club?: number[]; game?: number | null; meets?: number[] };
  /** Varies the tie-breaks: user id + week. */
  seed?: string;
  /** The Monday being built, and the built weeks before it, newest first. */
  weekOf?: string;
  history?: PastWeek[];
}): BuiltSession[] {
  const { target } = input;
  const pool = input.drills.filter((d) => d.minutes > 0);
  const byId = new Map(pool.map((d) => [d.id, d]));
  // Only tags some drill actually works on can lead a session.
  const focus = input.focus.filter((t) => pool.some((d) => drillTags(d).includes(t)));
  if (!pool.length || target.sessions < 1) return [];
  const seed = input.seed ?? '';
  const history = input.history ?? [];
  const recent = new Set([...(input.recent ?? []), ...history.slice(0, 2).flatMap((w) => w.sessions.flatMap((s) => s.drill_ids))]);
  const used = new Map<string, number>();

  // Last week, if it was the week before this one.
  const prev = input.weekOf && history[0]?.week_of === minusWeek(input.weekOf) ? history[0] : null;
  const light = !!input.weekOf && blockRun(input.weekOf, history) >= BLOCK;
  const doneShare = prev && prev.sessions.length ? prev.sessions.filter((s) => s.done).length / prev.sessions.length : null;
  const struggling = doneShare !== null && doneShare < 0.5;
  const minutes = light ? Math.max(5, Math.round(target.minutes * LIGHT)) : target.minutes;

  // Every drill from last week: where it got to, and whether it earned a step.
  type Memory = { step: number; earned: boolean; done: boolean };
  const memory = new Map<string, Memory>();
  for (const s of prev?.sessions ?? []) s.drill_ids.forEach((id, k) => {
    const done = s.done && (!s.ticked || s.ticked.some((t) => t === id || t.startsWith(`${id}:`)));
    const m: Memory = { step: s.steps[k] ?? 0, done, earned: done && s.feel !== 'hard' && !struggling && !light };
    const had = memory.get(id);
    if (!had || (m.done && !had.done)) memory.set(id, m);
  });

  // Every drill's last known step, from any week before: a drill that comes
  // back after a break carries on from there.
  const lastStep = new Map<string, number>();
  for (const w of history) for (const s of w.sessions) s.drill_ids.forEach((id, k) => {
    if (!lastStep.has(id)) lastStep.set(id, s.steps[k] ?? 0);
  });

  /** Where a kept drill goes next: the step, or its harder version. */
  const progress = (id: string): { id: string; step: number; change: Change } => {
    const m = memory.get(id)!;
    if (!m.earned) return { id, step: m.step, change: 'hold' };
    if (m.step + 1 <= MAX_STEP) return { id, step: m.step + 1, change: 'up' };
    const harder = byId.get(id)?.harder_id;
    if (harder && byId.has(harder)) return { id: harder, step: 0, change: 'harder' };
    return { id, step: MAX_STEP, change: 'same' };
  };

  // How well a new drill fits a session that leans on `lean`.
  const score = (d: DrillRow, lean: string | null) => {
    const tags = drillTags(d);
    let s = 0;
    if (lean && tags.includes(lean)) s += 6;
    s += tags.filter((t) => focus.includes(t)).length * 2;
    if (!tags.length) s -= 1;
    // A lighter or easier week wants what they know; a normal one, what they don't.
    if (recent.has(d.id)) s += light || struggling ? 4 : -3;
    s -= (used.get(d.id) ?? 0) * 8;
    return s + hash(`${seed}:${d.id}`);
  };

  // Drills that are another drill's harder version.
  const harderOf = new Set(pool.flatMap((d) => d.harder_id ? [d.harder_id] : []));
  // At the top step: handed over to a harder version (retired), or done all
  // it can (mastered: no longer kept every week, though it can come back).
  const top = [...lastStep].filter(([, n]) => n >= MAX_STEP).map(([id]) => id);
  const retired = new Set(top.filter((id) => { const h = byId.get(id)?.harder_id; return !!h && byId.has(h); }));
  const mastered = new Set(top.filter((id) => !retired.has(id)));

  const days = placeDays(target.sessions, input.busy ?? {});
  const out: BuiltSession[] = [];
  for (let i = 0; i < target.sessions; i++) {
    const lean = focus.length ? focus[i % focus.length] : null;
    const ids: string[] = [], steps: number[] = [], changes: Change[] = [];
    let total = 0;
    const take = (id: string, step: number, change: Change) => {
      ids.push(id); steps.push(step); changes.push(change); total += byId.get(id)!.minutes;
      used.set(id, (used.get(id) ?? 0) + 1);
    };
    const fits = (id: string) => !ids.includes(id) && total + byId.get(id)!.minutes <= minutes + 3;

    // Core: last week's drills for this focus, done ones first. Up to two,
    // or as many as fit in a lighter week.
    const core = [...memory.keys()]
      .filter((id) => byId.has(id) && !used.has(id) && !mastered.has(id) && (!lean || drillTags(byId.get(id)!).includes(lean)))
      .sort((a, b) => Number(memory.get(b)!.done) - Number(memory.get(a)!.done) || hash(`${seed}:${a}`) - hash(`${seed}:${b}`));
    for (const id of core.slice(0, light ? core.length : 2)) {
      const p = progress(id);
      if (!used.has(p.id) && fits(p.id)) take(p.id, p.step, p.change);
    }

    // New: the best fits for this focus, toward the target. A harder version
    // waits for its easier drill to hand over, unless nothing else fits.
    const ranked = [...pool].sort((a, b) => score(b, lean) - score(a, lean));
    for (const pass of [false, true]) for (const d of ranked) {
      if (total >= minutes - 2) break;
      if (!fits(d.id) || retired.has(d.id) || (!pass && harderOf.has(d.id) && !memory.has(d.id))) continue;
      const known = memory.get(d.id);
      if (!known) { const was = lastStep.get(d.id); take(d.id, was ?? 0, was === undefined ? 'new' : 'same'); continue; }
      // A drill from last week that turns up again here carries on from its step.
      const p = progress(d.id);
      take(d.id, p.id === d.id ? p.step : known.step, p.id === d.id && p.change === 'up' ? 'up' : 'same');
    }
    // Nothing fit (every drill is longer than the target): the shortest one.
    if (!ids.length) take([...pool].sort((a, b) => a.minutes - b.minutes)[0].id, 0, 'new');

    out.push({ name: nameFor(ids.map((id) => byId.get(id)!), lean), drill_ids: ids, steps, changes, weekday: days[i], minutes: total, light });
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
 * A drill's amount at a step: each step is about 15% more of its main number,
 * the reps in "3 × 50 each foot" or the time in "45 sec". Minutes are left
 * alone, since sessions are sized by them. With no number to raise, the step
 * is said in words.
 */
export function progressAmount(amount: string | null, step: number): string | null {
  if (!amount || step <= 0) return amount;
  const up = (n: number) => {
    const x = n * (1 + 0.15 * step);
    return x >= 20 ? Math.round(x / 5) * 5 : Math.max(n + step, Math.round(x));
  };
  const sets = amount.match(/(\d+)\s*[×xX*]\s*(\d+)/);
  if (sets) return amount.replace(sets[0], `${sets[1]} × ${up(Number(sets[2]))}`);
  const time = amount.match(/(\d+)\s*(s|sec|secs|seconds)\b/i);
  if (time) return amount.replace(time[0], `${up(Number(time[1]))} ${time[2]}`);
  const plain = amount.match(/\b(\d+)\b(?!\s*min)/i);
  if (plain) return amount.replace(plain[0], String(up(Number(plain[1]))));
  return `${amount} · level ${step + 1}`;
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

/** What the AI sends back for a session: its new drills only, a name and a note. */
export type Proposed = { name: string; new_drill_ids: string[]; note?: string };

/**
 * Takes the AI's sessions and makes them safe to publish. The rules' kept
 * drills (anything not 'new') stay, with their steps; the AI may only change
 * the new ones, and only for real drills not already kept, sized to the
 * session. Anything missing or broken stays as the rules had it.
 */
export function fitToTarget(proposed: Proposed[], rules: BuiltSession[], drills: DrillRow[], minutes: number, focus: string[]): (BuiltSession & { note?: string; fromAi: boolean })[] {
  const byId = new Map(drills.filter((d) => d.minutes > 0).map((d) => [d.id, d]));
  const mins = (ids: string[]) => ids.reduce((a, id) => a + (byId.get(id)?.minutes ?? 0), 0);
  const keptAll = new Set(rules.flatMap((s) => s.drill_ids.filter((_, k) => s.changes[k] !== 'new')));
  return rules.map((r, i) => {
    const p = proposed[i];
    if (!p) return { ...r, fromAi: false };
    const keep = r.drill_ids.map((id, k) => ({ id, step: r.steps[k], change: r.changes[k] })).filter((x) => x.change !== 'new');
    const room = (r.light ? Math.round(minutes * LIGHT) : minutes);
    let fresh = [...new Set((p.new_drill_ids ?? []).filter((id) => byId.has(id) && !keptAll.has(id)))]
      .filter((id) => byId.get(id)!.minutes <= room + 3);
    // Too long: drop new ones from the end. Too short: top up with the best fit.
    const ids = () => [...keep.map((x) => x.id), ...fresh];
    while (fresh.length && mins(ids()) > room + 3) fresh = fresh.slice(0, -1);
    while (mins(ids()) < room - 3) {
      const add = [...byId.values()].filter((d) => !ids().includes(d.id) && !keptAll.has(d.id) && mins(ids()) + d.minutes <= room + 3)
        .sort((a, b) => drillTags(b).filter((t) => focus.includes(t)).length - drillTags(a).filter((t) => focus.includes(t)).length)[0];
      if (!add) break;
      fresh.push(add.id);
    }
    if (!keep.length && !fresh.length) return { ...r, fromAi: false };
    const name = (p.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || r.name;
    const note = p.note?.replace(/\s+/g, ' ').trim().slice(0, 140) || undefined;
    return {
      ...r, name, note, fromAi: true,
      drill_ids: ids(), steps: [...keep.map((x) => x.step), ...fresh.map(() => 0)],
      changes: [...keep.map((x) => x.change), ...fresh.map((): Change => 'new')], minutes: mins(ids()),
    };
  });
}
