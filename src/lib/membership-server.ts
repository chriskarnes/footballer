import 'server-only';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getViewer } from './viewer';
import { playerAccess, toTerms, PLAYER_BILLING_COLUMNS, type Access, type PlayerBillingRow, type Terms } from './membership';

/** What an academy charges (0038). Null before the migration, or when it can't be read. */
export async function readTerms(db: SupabaseClient, academyId: string): Promise<Terms | null> {
  const { data, error } = await db.rpc('academy_terms', { p_academy: academyId });
  if (error) return null;
  return toTerms(data);
}

export type Membership = { terms: Terms; access: Access; row: PlayerBillingRow | null; academyName: string };

/**
 * Where the signed-in player stands at this academy: free days, paying, or
 * locked. Null for anyone it doesn't apply to: signed out, not a player here
 * (trainers never pay), or an academy where the trainer pays. Once per render.
 *
 * Anything that fails reads as "doesn't apply": a hiccup must not lock a
 * family out of training they've paid for.
 */
export const myMembership = cache(async (): Promise<Membership | null> => {
  try {
    const v = await getViewer();
    if (!v.academy || !v.user || v.role !== 'player') return null;
    const terms = await readTerms(v.db, v.academy.id);
    if (!terms || terms.mode !== 'players_pay') return null;
    const [member, billing] = await Promise.all([
      v.db.from('academy_members').select('joined_at').eq('academy_id', v.academy.id).eq('user_id', v.user.id).maybeSingle(),
      v.db.from('player_billing').select(PLAYER_BILLING_COLUMNS).eq('academy_id', v.academy.id).eq('user_id', v.user.id).maybeSingle(),
    ]);
    if (member.error || billing.error) return null;
    const row = (billing.data as PlayerBillingRow | null) ?? null;
    return { terms, row, academyName: v.academy.name, access: playerAccess(terms, member.data?.joined_at, row, Date.now()) };
  } catch {
    return null;
  }
});
