import 'server-only';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getViewer } from './viewer';
import { accessLabel, playerAccess, toTerms, type Access, type PlayerBillingRow, type Terms } from './membership';
import { withPrice } from './billing-server';

/** What an academy charges (0038). Null before the migration, or when it can't be read. */
export async function readTerms(db: SupabaseClient, academyId: string): Promise<Terms | null> {
  const { data, error } = await db.rpc('academy_terms', { p_academy: academyId });
  if (error) return null;
  return toTerms(data);
}

export type Membership = { terms: Terms; access: Access; row: PlayerBillingRow | null; academyName: string };

type MemberRow = { user_id?: string; joined_at: string | null; active?: boolean | null; paid_marked_at?: string | null };

/** A member's row with 0040's columns, or without them until it runs. */
async function memberRows(db: SupabaseClient, academyId: string, userId?: string): Promise<MemberRow[] | null> {
  const ask = (cols: string) => {
    let q = db.from('academy_members').select(cols).eq('academy_id', academyId).eq('role', 'player');
    if (userId) q = q.eq('user_id', userId);
    return q;
  };
  let r = await ask('user_id, joined_at, active, paid_marked_at');
  if (r.error?.code === '42703') r = await ask('user_id, joined_at');
  if (r.error) return null;
  return (r.data ?? []) as unknown as MemberRow[];
}

/**
 * When each player first joined this academy (0042), by account: what their
 * free days count from, so leaving and joining again doesn't start them
 * over. Empty before the migration, or when it can't be read: the day they
 * joined this time stands in.
 */
export async function trialStart(db: SupabaseClient, academyId: string, userId?: string): Promise<Map<string, string>> {
  try {
    let q = db.from('player_trials').select('user_id, started_at').eq('academy_id', academyId);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) return new Map();
    return new Map(((data ?? []) as { user_id: string; started_at: string }[]).map((r) => [r.user_id, r.started_at]));
  } catch {
    return new Map();
  }
}

/** True when the signed-in player may not open training here: free days over and no card, or switched off. */
export async function trainingLocked(): Promise<boolean> {
  const s = (await myMembership())?.access.state;
  return s === 'locked' || s === 'paused';
}

/**
 * Where the signed-in player stands at this academy: free days, paying,
 * locked, or switched off by their trainer. Null for anyone it doesn't apply
 * to: signed out, not a player here (trainers never pay), or an active player
 * where families don't pay. Once per render.
 *
 * Anything that fails reads as "doesn't apply": a hiccup must not lock a
 * family out of training they've paid for.
 */
export const myMembership = cache(async (): Promise<Membership | null> => {
  try {
    const v = await getViewer();
    if (!v.academy || !v.user || v.role !== 'player') return null;
    const [terms, members] = await Promise.all([readTerms(v.db, v.academy.id), memberRows(v.db, v.academy.id, v.user.id)]);
    const me = members?.[0];
    if (!terms || !me) return null;
    const active = me.active !== false;
    if (active && terms.mode !== 'players_pay') return null;
    const academyId = v.academy.id, userId = v.user.id;
    const [billing, began] = await Promise.all([
      withPrice((cols) => v.db.from('player_billing').select(cols).eq('academy_id', academyId).eq('user_id', userId).maybeSingle()),
      trialStart(v.db, academyId, userId),
    ]);
    if (billing.error && active) return null;
    const row = (billing.data as PlayerBillingRow | null) ?? null;
    return { terms, row, academyName: v.academy.name, access: playerAccess(terms, me.joined_at, row, Date.now(), active, began.get(userId)) };
  } catch {
    return null;
  }
});

export type RosterMark = {
  access: Access;
  active: boolean;
  /** When their trainer noted they'd paid them (trainer-pays academies). */
  paidMarkedAt: string | null;
  /** Short words for the list, or '' for nothing worth saying. */
  label: string;
  /** Something the trainer may want to act on. */
  attention: boolean;
};

/**
 * Every player's payment standing at an academy, for the trainer's lists
 * (0038, 0040). Where families pay it's Stripe's word; where the trainer
 * pays it's the trainer's own "paid" marks, shown only once they've started
 * using them. Empty when it can't be read.
 */
export async function rosterMarks(db: SupabaseClient, academyId: string): Promise<{ terms: Terms | null; marks: Map<string, RosterMark> }> {
  const marks = new Map<string, RosterMark>();
  try {
    const [terms, members] = await Promise.all([readTerms(db, academyId), memberRows(db, academyId)]);
    if (!terms || !members) return { terms, marks };
    const paying = terms.mode === 'players_pay'
      ? ((await withPrice((cols) => db.from('player_billing').select(cols).eq('academy_id', academyId), 'user_id, ')).data ?? []) as unknown as (PlayerBillingRow & { user_id: string })[]
      : [];
    const began = terms.mode === 'players_pay' ? await trialStart(db, academyId) : new Map<string, string>();
    const rows = new Map(paying.map((r) => [r.user_id, r]));
    const usesMarks = members.some((m) => m.paid_marked_at);
    const now = Date.now();
    for (const m of members) {
      if (!m.user_id) continue;
      const active = m.active !== false;
      const access = playerAccess(terms, m.joined_at, rows.get(m.user_id) ?? null, now, active, began.get(m.user_id));
      const paidMarkedAt = m.paid_marked_at ?? null;
      const label = !active ? 'Inactive'
        : terms.mode === 'players_pay' ? accessLabel(access)
        : terms.mode === 'trainer_pays' && usesMarks ? (paidMarkedAt ? 'Paid' : 'Not paid')
        : '';
      marks.set(m.user_id, { access, active, paidMarkedAt, label,
        attention: active && (access.state === 'locked' || access.state === 'past_due' || label === 'Not paid') });
    }
    return { terms, marks };
  } catch {
    return { terms: null, marks };
  }
}
