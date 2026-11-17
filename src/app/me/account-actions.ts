'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { cancelPlayerBilling, playerSubscriptions, stopSubscriptions } from '@/lib/billing-server';

type Result = { ok: true; note?: string } | { ok: false; error: string };
const LATER = 'That isn’t switched on yet. Try again later.';

/**
 * Leaves the academy this page is on (0035): out of it, its groups and
 * programs, and the weeks still to come. Their own history stays theirs.
 * The owner can't: the academy would have nobody.
 */
export async function leaveAcademy(): Promise<Result> {
  const v = await getViewer();
  if (!v.user || !v.academy) return { ok: false, error: 'You’re not signed in here.' };
  if (v.role === 'owner') return { ok: false, error: 'You own this academy, so you can’t leave it. Ask us to hand it over or close it.' };
  const { error } = v.role ? await v.db.rpc('leave_academy', { p_academy: v.academy.id }) : { error: null };
  if (error) {
    console.error('leave_academy', error);
    return { ok: false, error: error.code === 'PGRST202' ? LATER
      : /owner/i.test(error.message) ? 'You own this academy, so you can’t leave it. Ask us to hand it over or close it.'
      : 'Couldn’t do that. Try again.' };
  }
  revalidatePath('/', 'layout');
  // Gone from here: their family stops paying for it (0038). Also when they
  // had already left, so a second tap finishes what the first couldn't.
  if ((await cancelPlayerBilling(v.user.id, v.academy.id)).failed) {
    return { ok: false, error: 'You’ve left, but your card payments couldn’t be stopped. Tap Leave again; if it still says this, write to us and we’ll stop them.' };
  }
  return { ok: true };
}

/**
 * Deletes the signed-in account and everything kept under it (0035):
 * profile and photo, training history, plans, calendar link, memberships.
 * It can't be undone. Someone who owns an academy hands it over or has it
 * closed first.
 */
export async function deleteAccount(): Promise<Result> {
  const v = await getViewer();
  if (!v.user) return { ok: false, error: 'You’re not signed in.' };
  // The card payments are looked up before the account goes, while they can
  // still be found, and stopped only once it has: a delete that fails must
  // not leave someone locked out of training they've paid for.
  const subs = await playerSubscriptions(v.user.id);
  if (!subs) return { ok: false, error: 'Couldn’t check your card payments, so nothing was deleted. Try again in a minute.' };
  const { error } = await v.db.rpc('delete_account');
  if (error) {
    console.error('delete_account', error);
    return { ok: false, error: error.code === 'PGRST202' ? LATER
      : /owns an academy/i.test(error.message) ? 'You own an academy, and deleting your account would leave its players with nobody. Ask us to hand it over or close it first.'
      : 'Couldn’t delete it. Try again.' };
  }
  // The account is gone, so there's no trying again from here: say so.
  if (await stopSubscriptions(subs)) {
    return { ok: true, note: 'Your account is deleted, but a card payment couldn’t be stopped. Write to us and we’ll stop it and refund anything taken since.' };
  }
  return { ok: true };
}
