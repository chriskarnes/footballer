'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { academyTag } from '@/lib/branding-server';
import { serverClient } from '@/lib/supabase/server';
import { cancelPlayerBilling, stopBillingNotFor } from '@/lib/billing-server';

/**
 * Opens or closes a self-serve space (0030): open, anyone signed in joins with
 * a tap and the main site shows the way in. The database refuses it while the
 * space holds the licensed library, and refuses anyone but a platform admin.
 */
export async function setSelfServeOpen(id: string, slug: string, open: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await serverClient();
  const { error } = await db.rpc('admin_set_open', { p_academy: id, p_open: open });
  if (error) {
    console.error('admin_set_open', error);
    return { ok: false, error: /open_only_unlicensed|check constraint/i.test(error.message)
      ? 'It still has the Forge library, which is for private use. It stays invite-only until your own drills replace it.'
      : /not an admin/i.test(error.message) ? 'Only platform admins can open it.'
      : error.code === 'PGRST202' ? 'Run migration 0030 first.'
      : 'Couldn’t change that. Try again.' };
  }
  updateTag(academyTag(slug));
  revalidatePath('/admin/academies');
  revalidatePath(`/admin/academies/${id}`);
  return { ok: true };
}

/**
 * Replaces a self-serve space's invite link (0031): the old one stops
 * working. It has no owner to do it, so platform admins do.
 */
export async function replaceSelfServeInvite(id: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const db = await serverClient();
  const { data, error } = await db.rpc('admin_invite', { p_academy: id, p_rotate: true });
  if (error || typeof data !== 'string') {
    console.error('admin_invite', error);
    return { ok: false, error: error?.code === 'PGRST202' ? 'Run migration 0031 first.'
      : /not an admin/i.test(error?.message ?? '') ? 'Only platform admins can do that.' : 'Couldn’t replace it. Try again.' };
  }
  revalidatePath(`/admin/academies/${id}`);
  return { ok: true, code: data };
}

/**
 * Takes a player out of a self-serve space (0033): it has no owner to do
 * it. Their training stays theirs. The invite link is replaced with it
 * (0035), so the one they joined with doesn't let them back in.
 */
export async function removeSelfServeMember(academyId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await serverClient();
  const { error } = await db.rpc('admin_remove_member', { p_academy: academyId, p_user: userId });
  if (error) {
    console.error('admin_remove_member', error);
    return { ok: false, error: error.code === 'PGRST202' ? 'Run migration 0033 first.'
      : /not an admin/i.test(error.message) ? 'Only platform admins can do that.'
      : /not a member/i.test(error.message) ? 'They’re not in it any more.'
      : 'Couldn’t remove them. Try again.' };
  }
  const unpaid = await cancelPlayerBilling(userId, academyId);
  revalidatePath(`/admin/academies/${academyId}`);
  if (unpaid.failed) return { ok: false, error: 'They’re removed, but their card payments couldn’t be stopped. Cancel them in Stripe.' };
  return { ok: true };
}

/**
 * Gives an academy free time (0037), or takes it away: the owner's card isn't
 * charged until after that day. Read when they add the card; a card already
 * added keeps the date it was given.
 */
export async function setFreeUntil(id: string, until: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (until !== null && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { ok: false, error: 'Pick a date.' };
  const db = await serverClient();
  const { error } = await db.rpc('admin_set_free_until', { p_academy: id, p_until: until });
  if (error) {
    console.error('admin_set_free_until', error);
    return { ok: false, error: error.code === 'PGRST202' ? 'Run migration 0037 first.'
      : /admins only/i.test(error.message) ? 'Only platform admins can do that.' : 'Couldn’t save that. Try again.' };
  }
  revalidatePath(`/admin/academies/${id}`);
  return { ok: true };
}

/**
 * Who pays at an academy (0038, 0040): each player's family by card, at this
 * price and after this many free days; the trainer, $5 a player; or nobody.
 */
export async function setBilling(id: string, mode: 'players_pay' | 'trainer_pays' | 'none', priceDollars: number, trialDays: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const cents = Math.round(priceDollars * 100);
  if (!['players_pay', 'trainer_pays', 'none'].includes(mode)) return { ok: false, error: 'Pick who pays.' };
  if (!Number.isFinite(cents) || cents < 100 || cents > 100000) return { ok: false, error: 'Set a price between $1 and $1,000.' };
  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) return { ok: false, error: 'Free days can be 0 to 365.' };
  const db = await serverClient();
  const { error } = await db.rpc('admin_set_billing', { p_academy: id, p_mode: mode, p_price_cents: cents, p_trial_days: trialDays });
  if (error) {
    console.error('admin_set_billing', error);
    return { ok: false, error: error.code === 'PGRST202' ? 'Run migration 0040 first.'
      : /admins only/i.test(error.message) ? 'Only platform admins can do that.' : 'Couldn’t save that. Try again.' };
  }
  revalidatePath('/', 'layout');
  // The payments that no longer apply stop with it: families' when families
  // no longer pay here, the trainer's when the trainer no longer does.
  // Otherwise they'd go on being charged with nothing in the app to say so.
  const failed = await stopBillingNotFor(id, mode);
  if (failed) return { ok: false, error: `Saved, but ${failed} card ${failed === 1 ? 'payment' : 'payments'} couldn’t be stopped. Cancel ${failed === 1 ? 'it' : 'them'} in Stripe.` };
  return { ok: true };
}
