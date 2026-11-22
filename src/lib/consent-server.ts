import 'server-only';
import { cache } from 'react';
import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getViewer } from './viewer';
import { consentNeed, isUnder13, shortName } from './child';
import { emailOn } from './email';
import { notMadeYet } from './service-db';

/**
 * Where the signed-in player stands on a parent's or guardian's agreement
 * (0043). Read once per render, for the frame and each training page.
 */
export type ConsentGateInfo = {
  how: 'here' | 'email';
  /** The player's first name, for "Before Sam trains". */
  name: string;
  academy: string;
  /** Where a request last went, if one did. */
  sentTo: string | null;
  /** The account's own email: who the confirmation goes to when it's the parent's. */
  accountEmail: string | null;
};

type Child = { under13: boolean; staffAnywhere: boolean; gate: ConsentGateInfo | null };

/** Whether the account is staff at any academy: a trainer, here for their own child. */
export async function staffSomewhere(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.from('academy_members').select('role').eq('user_id', userId).in('role', ['owner', 'trainer']).limit(1);
  return !!data?.length;
}

/**
 * The signed-in player, as far as their age goes. Anything that fails reads
 * as "no gate": a hiccup mustn't lock a player out, and the daily clean-up
 * and the next page load ask again.
 */
export const myChild = cache(async (): Promise<Child | null> => {
  try {
    const v = await getViewer();
    if (!v.user || !v.academy || v.role !== 'player') return null;
    const { data: prof } = await v.db.from('profiles').select('display_name, age_band, signed_up_by').eq('id', v.user.id).maybeSingle();
    const p = prof as { display_name: string | null; age_band: string | null; signed_up_by: string | null } | null;
    if (!isUnder13(p?.age_band)) return { under13: false, staffAnywhere: false, gate: null };
    const staffAnywhere = await staffSomewhere(v.db, v.user.id);
    const { data: row, error } = await v.db.from('parent_consents').select('parent_email, requested_at, agreed_at').eq('user_id', v.user.id).maybeSingle();
    // Before 0043 runs: nobody is asked.
    if (error) return { under13: true, staffAnywhere, gate: null };
    const c = row as { parent_email: string | null; requested_at: string | null; agreed_at: string | null } | null;
    const need = consentNeed({
      ageBand: p?.age_band, email: v.user.email, staffHere: false,
      parentHeld: p?.signed_up_by === 'parent' || staffAnywhere, agreed: !!c?.agreed_at, canEmail: emailOn(),
    });
    return {
      under13: true, staffAnywhere,
      gate: need && {
        how: need.how, name: shortName(p?.display_name).split(' ')[0] || 'Your player', academy: v.academy.name,
        sentTo: c?.requested_at ? c.parent_email : null, accountEmail: v.user.email ?? null,
      },
    };
  } catch {
    return null;
  }
});

/** The agreement screen to show in place of training, or null. */
export const myConsentGate = async () => (await myChild())?.gate ?? null;

/** A player under 13 (not a trainer here for their own child): no photo, no typed requests to the AI. */
export const isChildPlayer = async () => { const c = await myChild(); return !!c?.under13 && !c.staffAnywhere; };

/** A new link's secret, and what's kept of it. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** The academies a player trains at, by name, for the request email and the link's page. */
export async function playerAcademies(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await db.from('academy_members').select('academies(name)').eq('user_id', userId).eq('role', 'player');
  if (error) return [];
  return ((data ?? []) as unknown as { academies: { name: string } | null }[]).map((r) => r.academies?.name).filter((n): n is string => !!n);
}

export { notMadeYet };
