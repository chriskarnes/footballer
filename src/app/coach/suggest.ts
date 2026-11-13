'use server';
import { drillTags } from '@/lib/academy-week';
import { allowed, client, logCall, MODEL } from '@/lib/ai';
import { plain } from '@/lib/plain-error';
import { getViewer } from '@/lib/viewer';
import { loadContent } from '@/lib/academy-data';
import { loadPlayers } from '@/lib/coach-data';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';

export type Suggestion = { ok: true; drillId: string; note: string; why: string; by: 'ai' | 'rules' } | { ok: false; error: string };

/** What Gemini must answer with: one of the trainer's drills, and a note. */
const PICK_SCHEMA = {
  type: 'object',
  properties: {
    drill_id: { type: 'string', description: 'The id of a drill from the list. Must be one of the given ids.' },
    note: { type: 'string', description: 'One or two short sentences to the player, in the trainer\'s voice. Name them. No emoji.' },
    why: { type: 'string', description: 'A few words for the trainer on why this drill.' },
  },
  required: ['drill_id', 'note', 'why'],
};

const SYSTEM = 'You help a youth soccer trainer personalise at-home training. Choose one drill from the trainer\'s list that fits this player right now: something their group work doesn\'t already cover, short enough to actually get done if they\'re behind.';

/**
 * A "just for you" drill for one player, for the trainer to approve. Picks
 * only from the academy's own drills, from what's known about the player:
 * their profile, how their week is going, and what they've done lately.
 * Gemini when there's a key; a plain rule when there isn't, or it fails.
 */
export async function suggestAddon(userId: string): Promise<Suggestion> {
  // Any failure reading the academy or the player comes back as a sentence
  // on the form, not the error page.
  try { return await suggest(userId); }
  catch (e) { return { ok: false, error: plain(e, 'Couldn’t suggest one just now. Pick a drill instead.') }; }
}

async function suggest(userId: string): Promise<Suggestion> {
  const v = await getViewer();
  if (!v.academy || !v.staff) return { ok: false, error: 'Only trainers can do that.' };
  const content = await loadContent(v.db, v.academy.id);
  if (!content.drills.length) return { ok: false, error: 'Add some drills first. Suggestions come from your own drills.' };
  const { players } = await loadPlayers(v.db, v.academy, { player: userId, days: 28, content });
  const p = players[0];
  if (!p) return { ok: false, error: 'Player not found.' };

  const thisWeek = new Set(p.week.flatMap((it) => it.kind === 'addon' ? [it.title] : []));
  const candidates = content.drills.filter((d) => !thisWeek.has(d.name));
  const pool = candidates.length ? candidates : content.drills;

  // Within the AI's limits (see lib/ai.ts), or straight to the rule.
  const gate = await allowed(v.db, { academyId: v.academy.id, timeZone: v.academy.timeZone, playerId: userId, kind: 'suggest' });
  const ai = gate.ok ? client() : null;
  if (ai) {
    let usage: unknown = null, ok = false;
    try {
      const facts = {
        name: p.first,
        positions: p.positions, age: p.age_band,
        groups: p.groups,
        this_week: { status: p.progress.reason, done: p.progress.done, planned: p.progress.planned, sessions: p.week.map((w) => `${w.title}${w.done ? ' (done)' : ''}`) },
        recent: p.done.slice(0, 8).map((d) => d.title),
        days_since_last: p.progress.daysSince,
      };
      const drills = pool.map((d) => ({ id: d.id, name: d.name, amount: d.amount, minutes: d.minutes,
        works_on: drillTags(d).map((t) => FOCUS_LABELS[t as FocusArea] ?? t) }));
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: `Player:\n${JSON.stringify(facts)}\n\nThe trainer's drills:\n${JSON.stringify(drills)}`,
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: 'application/json',
          responseJsonSchema: PICK_SCHEMA,
          // A trainer is waiting on the button; fall back rather than hang.
          abortSignal: AbortSignal.timeout(15000),
        },
      });
      usage = res.usageMetadata ?? null;
      const input = JSON.parse(res.text ?? '{}') as { drill_id?: string; note?: string; why?: string };
      if (input.drill_id && pool.some((d) => d.id === input.drill_id)) {
        ok = true;
        return { ok: true, drillId: input.drill_id, note: String(input.note ?? '').slice(0, 200), why: String(input.why ?? ''), by: 'ai' };
      }
    } catch (e) {
      console.error('suggestAddon: Gemini failed, using the rule', e instanceof Error ? e.message : e);
    } finally {
      await logCall(v.db, { academyId: v.academy.id, actorId: v.user?.id ?? null, playerId: userId, kind: 'suggest', ok, usage });
    }
  }

  // The rule: the shortest drill they haven't done lately, so it gets done.
  const recent = new Set(p.done.slice(0, 10).map((d) => d.title));
  const pick = [...pool].sort((a, b) => Number(recent.has(a.name)) - Number(recent.has(b.name)) || a.minutes - b.minutes)[0];
  const behind = p.progress.status !== 'good';
  return {
    ok: true, drillId: pick.id, by: 'rules',
    why: behind ? 'Short, to get them going again' : 'Something they haven’t done lately',
    note: behind
      ? `${p.first}, just this one today. ${pick.minutes} minutes and you’re back on track.`
      : `${p.first}, here’s one extra for you this week. Nice work so far.`,
  };
}
