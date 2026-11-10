import 'server-only';
import { drillTags, type DrillRow } from './academy-week';
import { client, MODEL } from './ai';
import { candidates, progressAmount, type BuiltSession, type Proposed, type Target } from './week-builder';
import { FOCUS_LABELS, type FocusArea } from './types';

const label = (t: string) => FOCUS_LABELS[t as FocusArea] ?? t;

const SYSTEM = `You help plan one youth soccer player's at-home training week, using only their trainer's drills.
Each session already has kept drills, chosen to build on last week: some step up (more reps or time), some move to a harder version, some hold. You cannot change those.
For each session, in the same order:
- new_drill_ids: pick the new drills to go with the kept ones, from the candidate list only, so the session's total minutes land close to its target (within 3). Lean on the session's focus. Avoid drills they did recently; don't repeat a drill in the week.
- name: one to three words, after what the session works on.
- note: one plain sentence to the player, under 15 words. If a kept drill stepped up or got harder, say so simply ("Wall passes go up to 60 each foot"). In a lighter week, say it's a lighter one. Use their first name at most once in the week. No emoji, no hype.`;

/**
 * Asks the AI for a week. Returns what it proposed and the token usage, or
 * null on any failure; the caller checks and fixes the proposal
 * (fitToTarget) and falls back to rules without it.
 */
export async function proposeWeek(input: {
  first: string; age: string | null; positions: string[] | null;
  target: Target; focus: string[]; drills: DrillRow[]; recent: string[];
  /** The rules' week: kept drills and what happened to them. */
  week: BuiltSession[];
  /** What they did lately, by title: how the last weeks went. */
  lately: { done: number; planned: number; titles: string[] };
}): Promise<{ sessions: Proposed[]; usage: unknown } | { sessions: null; usage: unknown }> {
  const ai = client();
  if (!ai) return { sessions: null, usage: null };
  const kept = new Set(input.week.flatMap((s) => s.drill_ids.filter((_, k) => s.changes[k] !== 'new')));
  const pool = candidates(input.drills.filter((d) => !kept.has(d.id)), input.focus, input.recent);
  const byId = new Map(input.drills.map((d) => [d.id, d]));
  const n = input.target.sessions;
  const schema = {
    type: 'object',
    properties: {
      sessions: {
        type: 'array', minItems: n, maxItems: n,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            new_drill_ids: { type: 'array', items: { type: 'string' }, description: 'Ids from the candidate list, in the order to do them.' },
            note: { type: 'string' },
          },
          required: ['name', 'new_drill_ids', 'note'],
        },
      },
    },
    required: ['sessions'],
  };
  const facts = {
    player: { first_name: input.first, age: input.age, positions: input.positions },
    focus: input.focus.map(label),
    lighter_week: input.week.some((s) => s.light),
    sessions: input.week.map((s) => ({
      target_minutes: s.light ? Math.round(input.target.minutes * 0.65) : input.target.minutes,
      kept: s.drill_ids.flatMap((id, k) => {
        if (s.changes[k] === 'new') return [];
        const d = byId.get(id);
        return d ? [{ name: d.name, minutes: d.minutes, amount: progressAmount(d.amount, s.steps[k]), change: s.changes[k] }] : [];
      }),
    })),
    recently: { finished_last_week: `${input.lately.done} of ${input.lately.planned}`, sessions: input.lately.titles.slice(0, 8), recent_drill_ids: input.recent.slice(0, 20) },
    candidates: pool.map((d) => ({ id: d.id, name: d.name, minutes: d.minutes, amount: d.amount, works_on: drillTags(d).map(label) })),
  };
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: JSON.stringify(facts),
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        // A trainer may be waiting on the button: fall back rather than hang.
        abortSignal: AbortSignal.timeout(20000),
      },
    });
    const out = JSON.parse(res.text ?? '{}') as { sessions?: Proposed[] };
    return { sessions: Array.isArray(out.sessions) ? out.sessions : null, usage: res.usageMetadata ?? null };
  } catch (e) {
    console.error('proposeWeek: AI failed, using the rules', e instanceof Error ? e.message : e);
    return { sessions: null, usage: null };
  }
}
