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
/** Each academy's monthly ceiling, for the admin panel. */
export const aiMonthlyLimit = () => PER_ACADEMY_MONTH;

/**
 * The instant a local day starts in `tz`, as a UTC timestamp. created_at is
 * an instant, so a bare 'YYYY-MM-DD' would cut at UTC midnight: hours off the
 * academy's own month or week, either side. Checked twice so a clock change
 * between UTC midnight and the local one still lands on the hour.
 */
export function zoneMidnight(day: string, tz: string): string {
  const wall = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
  const offset = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  let t = wall - offset(wall);
  t = wall - offset(t);
  return new Date(t).toISOString();
}

/** How much AI this academy has used this month, against its limit. Null when it can't say. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function usage(db: any, academyId: string, timeZone: string): Promise<{ used: number; limit: number; on: boolean } | null> {
  const monthStart = zoneMidnight(`${localDate(new Date(), timeZone).slice(0, 7)}-01`, timeZone);
  const { count, error } = await db.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('academy_id', academyId).gte('created_at', monthStart);
  return error ? null : { used: count ?? 0, limit: PER_ACADEMY_MONTH, on: !!process.env.GEMINI_API_KEY };
}

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

/**
 * Calls let through but not logged yet, on this server. The log is only
 * written once the AI answers, seconds later, so two builds started together
 * would both read the same count and both go. Counting these as well closes
 * that gap on one server; across servers it stays open until the check and
 * the log are one step in the database (an RPC, which needs a migration).
 * A reservation lapses after two minutes in case its call never logs.
 *
 * Each call's hold has its own id, and only that call's log lets it go: after
 * one hold has lapsed, the next log mustn't take another call's live one.
 */
const inFlight = new Map<string, { id: number; at: number }[]>();
const HOLD_MS = 120_000;
let nextHold = 0;
function held(key: string) {
  const now = Date.now();
  const live = (inFlight.get(key) ?? []).filter((h) => now - h.at < HOLD_MS);
  if (live.length) inFlight.set(key, live); else inFlight.delete(key);
  return live.length;
}
const hold = (key: string, id: number) => inFlight.set(key, [...(inFlight.get(key) ?? []), { id, at: Date.now() }]);
const release = (key: string, id: number) => {
  const live = (inFlight.get(key) ?? []).filter((h) => h.id !== id);
  if (live.length) inFlight.set(key, live); else inFlight.delete(key);
};
const playerKey = (academyId: string, playerId: string, kind: AiKind) => `${academyId}:${playerId}:${kind}`;

/**
 * May this call go to the AI? Counts what the log already holds, and calls
 * still out. Allowed, it comes with a hold to hand back to logCall.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function allowed(db: any, a: { academyId: string; timeZone: string; playerId: string | null; kind: AiKind }): Promise<{ ok: true; hold: number } | { ok: false; why: Denied }> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, why: 'no_key' };
  const today = localDate(new Date(), a.timeZone);
  const monthStart = zoneMidnight(`${today.slice(0, 7)}-01`, a.timeZone);
  const weekStart = zoneMidnight(mondayOf(today), a.timeZone);
  const [month, player] = await Promise.all([
    db.from('ai_usage').select('id', { count: 'exact', head: true }).eq('academy_id', a.academyId).gte('created_at', monthStart),
    a.playerId
      ? db.from('ai_usage').select('id', { count: 'exact', head: true })
          .eq('academy_id', a.academyId).eq('player_id', a.playerId).eq('kind', a.kind).gte('created_at', weekStart)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  // Can't read the log, can't keep to the limits: don't spend.
  if (month.error || player.error) return { ok: false, why: 'no_log' };
  if ((month.count ?? 0) + held(a.academyId) >= PER_ACADEMY_MONTH) return { ok: false, why: 'academy_limit' };
  const pk = a.playerId ? playerKey(a.academyId, a.playerId, a.kind) : null;
  if ((player.count ?? 0) + (pk ? held(pk) : 0) >= PER_PLAYER_WEEK) return { ok: false, why: 'player_limit' };
  const id = ++nextHold;
  hold(a.academyId, id);
  if (pk) hold(pk, id);
  return { ok: true, hold: id };
}

/**
 * Writes one call to the log. Never throws: a log that fails mustn't fail the
 * build. `hold` is what allowed() gave this call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logCall(db: any, row: {
  academyId: string; actorId: string | null; playerId: string | null; kind: AiKind; ok: boolean; hold: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  usage?: any; inputHash?: string;
}) {
  let logged = false;
  try {
    const u = row.usage ?? {};
    const { error } = await db.from('ai_usage').insert({
      academy_id: row.academyId, actor_id: row.actorId, player_id: row.playerId, kind: row.kind, model: MODEL, ok: row.ok,
      input_tokens: u.promptTokenCount ?? 0,
      // Thinking is billed as output.
      output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      input_hash: row.inputHash ?? null,
    });
    // The client hands back a refused insert rather than throwing it.
    if (error) console.error('logCall: ai_usage insert failed', error.message);
    else logged = true;
  } catch (e) {
    console.error('logCall: ai_usage insert failed', e instanceof Error ? e.message : e);
  } finally {
    // In the log now: its count takes over from the hold. Not logged, the
    // hold stays until it lapses, so the call still counts here a while.
    if (logged) {
      release(row.academyId, row.hold);
      if (row.playerId) release(playerKey(row.academyId, row.playerId, row.kind), row.hold);
    }
  }
}

/** A short stable fingerprint of what went in to a call. */
export const fingerprint = (x: unknown) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 16);
