import 'server-only';
import { drillTags, type DrillRow } from './academy-week';
import { client, MODEL } from './ai';
import { candidates, type Proposed, type Target } from './week-builder';
import { FOCUS_LABELS, type FocusArea } from './types';

const label = (t: string) => FOCUS_LABELS[t as FocusArea] ?? t;

const SYSTEM = `You plan one youth soccer player's at-home training week, using only their trainer's drills.
Rules:
- Exactly the number of sessions asked for.
- Each session's drills add up close to the minutes asked for (within 3), using each drill's minutes.
- Lean each session on the player's focus areas, sharing them across the week.
- Vary the week: avoid drills they did recently, and don't repeat a drill in a session.
- Name each session in one to three words, after what it works on.
- note: one plain sentence to the player about that session, under 15 words. Use their first name at most once in the week. No emoji, no hype.`;

/**
 * Asks the AI for a week. Returns what it proposed and the token usage, or
 * null on any failure; the caller checks and fixes the proposal
 * (fitToTarget) and falls back to rules without it.
 */
export async function proposeWeek(input: {
  first: string; age: string | null; positions: string[] | null;
  target: Target; focus: string[]; drills: DrillRow[]; recent: string[];
  /** What they did lately, by title: how the last weeks went. */
  lately: { done: number; planned: number; titles: string[] };
}): Promise<{ sessions: Proposed[]; usage: unknown } | { sessions: null; usage: unknown }> {
  const ai = client();
  if (!ai) return { sessions: null, usage: null };
  const pool = candidates(input.drills, input.focus, input.recent);
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
            drill_ids: { type: 'array', items: { type: 'string' }, description: 'Ids from the drill list, in the order to do them.' },
            note: { type: 'string' },
          },
          required: ['name', 'drill_ids', 'note'],
        },
      },
    },
    required: ['sessions'],
  };
  const facts = {
    player: { first_name: input.first, age: input.age, positions: input.positions },
    week: { sessions: n, minutes_each: input.target.minutes },
    focus: input.focus.map(label),
    recently: { finished_last_week: `${input.lately.done} of ${input.lately.planned}`, sessions: input.lately.titles.slice(0, 8), recent_drill_ids: input.recent.slice(0, 20) },
    drills: pool.map((d) => ({ id: d.id, name: d.name, minutes: d.minutes, amount: d.amount, works_on: drillTags(d).map(label) })),
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
