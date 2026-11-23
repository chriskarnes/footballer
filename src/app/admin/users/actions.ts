'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { AGE_BANDS, isUnder13 } from '@/lib/child';
import { serviceDb } from '@/lib/service-db';

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Puts a person's age right, for when it was picked by mistake: a player
 * can't raise their own age past 12 until a parent or guardian agrees (0043,
 * 0044), so a teenager or adult who tapped "10–12" asks support, and this is
 * how it's fixed. Only a platform admin; written with the server's key, which
 * the database's age rule trusts. Taken out of under 13, a waiting request
 * goes, and with it the 30 days. Put into under 13, the photo, club and area
 * go, as the app does for any player under 13 who isn't staff.
 */
export async function setAgeBand(userId: string, band: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await getViewer();
  if (!v.user || !v.isAdmin) return { ok: false, error: 'Only platform admins can do that.' };
  if (!UUID.test(userId)) return { ok: false, error: 'That isn’t an account.' };
  if (!AGE_BANDS.some(([b]) => b === band)) return { ok: false, error: 'Pick an age.' };
  const db = serviceDb();
  if (!db) return { ok: false, error: 'The server’s database key isn’t set.' };

  let patch: Record<string, unknown> = { age_band: band };
  if (isUnder13(band)) {
    const { data: staff, error: se } = await db.from('academy_members').select('role').eq('user_id', userId).in('role', ['owner', 'trainer']).limit(1);
    if (se) { console.error('setAgeBand staff', se); return { ok: false, error: 'Couldn’t save that. Try again.' }; }
    if (!staff?.length) patch = { ...patch, avatar_type: null, avatar_data: null, avatar_updated_at: null, region: null, club: null };
  }
  const { data, error } = await db.from('profiles').update(patch).eq('id', userId).select('id');
  if (error) { console.error('setAgeBand', error); return { ok: false, error: 'Couldn’t save that. Try again.' }; }
  if (!data?.length) return { ok: false, error: 'They haven’t set up a profile yet.' };

  if (!isUnder13(band)) {
    const { error: ce } = await db.from('parent_consents').delete().eq('user_id', userId).is('agreed_at', null);
    if (ce && ce.code !== '42P01' && ce.code !== 'PGRST205') console.error('setAgeBand consent', ce);
  }
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}
