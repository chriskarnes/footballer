import 'server-only';
import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { localDate, mondayOf } from './progress';

/**
 * The one way in to the AI: whether a call is allowed, the client, and the
 * log every call goes in (0011). Anything that can't ask, or isn't allowed
 * to, falls back to its rules; nothing waits on the AI to work.
 *
 * Limits, both read from the log:
 *   - per player, per kind, per week: a few rebuilds, not a slot machine;
 *   - per academy, per month: a ceiling for everything, Autopilot included.
 */
export const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const PER_PLAYER_WEEK = Number(process.env.AI_PLAYER_WEEKLY_LIMIT) || 6;
const PER_ACADEMY_MONTH = Number(process.env.AI_ACADEMY_MONTHLY_LIMIT) || 600;

export type AiKind = 'week' | 'suggest';
export type Denied = 'no_key' | 'player_limit' | 'academy_limit' | 'no_log';

export const DENIED: Record<Denied, string> = {
  no_key: 'AI isn’t set up',
  player_limit: 'AI limit for this player this week reached',
  academy_limit: 'AI limit for this month reached',
  no_log: 'AI usage log missing (run migration 0011)',
};

export function client(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  return key ? new GoogleGenAI({ apiKey: key }) : null;
}

/** May this call go to the AI? Counts what the log already holds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function allowed(db: any, a: { academyId: string; timeZone: string; playerId: string | null; kind: AiKind }): Promise<{ ok: true } | { ok: false; why: Denied }> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, why: 'no_key' };
  const today = localDate(new Date(), a.timeZone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [month, player] = await Promise.all([
    db.from('ai_usage').select('id', { count: 'exact', head: true }).eq('academy_id', a.academyId).gte('created_at', monthStart),
    a.playerId
      ? db.from('ai_usage').select('id', { count: 'exact', head: true })
          .eq('academy_id', a.academyId).eq('player_id', a.playerId).eq('kind', a.kind).gte('created_at', mondayOf(today))
      : Promise.resolve({ count: 0, error: null }),
  ]);
  // Can't read the log, can't keep to the limits: don't spend.
  if (month.error || player.error) return { ok: false, why: 'no_log' };
  if ((month.count ?? 0) >= PER_ACADEMY_MONTH) return { ok: false, why: 'academy_limit' };
  if ((player.count ?? 0) >= PER_PLAYER_WEEK) return { ok: false, why: 'player_limit' };
  return { ok: true };
}

/** Writes one call to the log. Never throws: a log that fails mustn't fail the build. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logCall(db: any, row: {
  academyId: string; actorId: string | null; playerId: string | null; kind: AiKind; ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  usage?: any; inputHash?: string;
}) {
  try {
    const u = row.usage ?? {};
    await db.from('ai_usage').insert({
      academy_id: row.academyId, actor_id: row.actorId, player_id: row.playerId, kind: row.kind, model: MODEL, ok: row.ok,
      input_tokens: u.promptTokenCount ?? 0,
      // Thinking is billed as output.
      output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      input_hash: row.inputHash ?? null,
    });
  } catch { /* logged or not, carry on */ }
}

/** A short stable fingerprint of what went in to a call. */
export const fingerprint = (x: unknown) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 16);
