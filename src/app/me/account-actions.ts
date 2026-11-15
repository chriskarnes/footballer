'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';

type Result = { ok: true } | { ok: false; error: string };
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
  if (!v.role) return { ok: true };
  const { error } = await v.db.rpc('leave_academy', { p_academy: v.academy.id });
  if (error) {
    console.error('leave_academy', error);
    return { ok: false, error: error.code === 'PGRST202' ? LATER
      : /owner/i.test(error.message) ? 'You own this academy, so you can’t leave it. Ask us to hand it over or close it.'
      : 'Couldn’t do that. Try again.' };
  }
  revalidatePath('/', 'layout');
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
  const { error } = await v.db.rpc('delete_account');
  if (error) {
    console.error('delete_account', error);
    return { ok: false, error: error.code === 'PGRST202' ? LATER
      : /owns an academy/i.test(error.message) ? 'You own an academy, and deleting your account would leave its players with nobody. Ask us to hand it over or close it first.'
      : 'Couldn’t delete it. Try again.' };
  }
  return { ok: true };
}
