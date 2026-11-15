'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { plain } from '@/lib/plain-error';
import { localDate, mondayOf } from '@/lib/progress';
import { cancelPlayerBilling } from '@/lib/billing-server';

/**
 * The trainer area's writes. Each goes through a database function that
 * checks staff membership itself; the academy is always the one this request
 * came in on, never an id from the browser.
 */
async function staff() {
  const v = await getViewer();
  if (!v.academy || !v.user || !v.staff) return null;
  return v as typeof v & { academy: NonNullable<typeof v.academy> };
}

export async function sendNote(input: { body: string; to: string[] | null; kind: 'note' | 'nudge' }) {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can send notes.' };
  const body = input.body.trim();
  if (!body) return { ok: false as const, error: 'Write something first.' };
  // Nobody picked isn't everybody: only an explicit null sends to all.
  if (input.to && !input.to.length) return { ok: false as const, error: 'Pick who it’s for.' };
  if (body.length > 1000) return { ok: false as const, error: 'Keep it under 1,000 characters.' };

  const { error } = await v.db.rpc('send_note', {
    p_academy: v.academy.id, p_body: body, p_to: input.to?.length ? input.to : null, p_kind: input.kind,
  });
  if (error) return { ok: false as const, error: plain(error) };

  revalidatePath('/coach', 'layout');
  // Sent from the note dialog: the page it's over stays where it is.
  return { ok: true as const };
}

export async function rotateInvite(role: 'player' | 'trainer') {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can do that.' };
  const { data, error } = await v.db.rpc('rotate_invite', { p_academy: v.academy.id, p_role: role });
  if (error) return { ok: false as const, error: plain(error) };
  revalidatePath('/coach', 'layout');
  return { ok: true as const, code: data as string };
}

export async function removeMember(userId: string) {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can do that.' };
  // RLS decides: staff remove players, only the owner removes a trainer.
  const { error, count } = await v.db.from('academy_members')
    .delete({ count: 'exact' }).eq('academy_id', v.academy.id).eq('user_id', userId);
  if (error) return { ok: false as const, error: plain(error) };
  if (!count) {
    // Still here: not theirs to remove. Gone already (a second tap, after a
    // clean-up that didn't finish): carry on and finish it.
    const { data: still } = await v.db.from('academy_members').select('user_id').eq('academy_id', v.academy.id).eq('user_id', userId).maybeSingle();
    if (still) return { ok: false as const, error: 'You can’t remove that person.' };
  }
  // Removed by their trainer: their family stops paying for it (0038).
  await cancelPlayerBilling(userId, v.academy.id);
  // Out of their groups and programs too, so they stop counting in them, and
  // their plan settings and the weeks still to come: someone let back in
  // later starts fresh, not on a week built before they left. Past weeks
  // stay, as their history.
  const from = mondayOf(localDate(new Date(), v.academy.timeZone));
  const cleared = await Promise.all([
    v.db.from('group_members').delete().eq('academy_id', v.academy.id).eq('user_id', userId),
    v.db.from('player_programs').delete().eq('academy_id', v.academy.id).eq('user_id', userId),
    v.db.from('player_plans').delete().eq('academy_id', v.academy.id).eq('user_id', userId),
    v.db.from('player_week_sessions').delete().eq('academy_id', v.academy.id).eq('user_id', userId).gte('week_of', from),
    v.db.from('addons').delete().eq('academy_id', v.academy.id).eq('user_id', userId).gte('week_of', from),
  ]);
  revalidatePath('/coach', 'layout');
  // Said, not swallowed: left behind, they'd be back in their old groups
  // and week the day they were let in again.
  const failed = cleared.find((r) => r.error);
  if (failed) {
    console.error('removeMember: clean-up', failed.error);
    return { ok: false as const, error: 'They’re removed, but their groups and plan couldn’t all be cleared. Tap Remove again to finish.' };
  }
  return { ok: true as const };
}

/** Let a player in who asked to join, or turn them away. */
export async function answerJoinRequest(userId: string, approve: boolean, shown: 'player' | 'trainer' = 'player') {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can do that.' };
  const role = shown === 'trainer' ? 'trainer' : 'player';
  // With the kind of request the card showed (0035): if it has changed since
  // (a player request that's become a trainer one), it isn't the one answered.
  let { error } = await v.db.rpc('answer_join_request', { p_academy: v.academy.id, p_user: userId, p_approve: approve, p_role: role });
  if (error?.code === 'PGRST202') ({ error } = await v.db.rpc('answer_join_request', { p_academy: v.academy.id, p_user: userId, p_approve: approve }));
  if (error && /request changed/i.test(error.message)) {
    revalidatePath('/coach', 'layout');
    return { ok: false as const, error: 'That request has changed since this page loaded. Have another look before answering.' };
  }
  // Another trainer answered it first: nothing left to do, and nothing wrong,
  // but say so rather than claim this tap let them in.
  const already = !!error && /no such request/i.test(error.message);
  if (error && /owner/i.test(error.message)) return { ok: false as const, error: 'Only the academy’s owner lets trainers in.' };
  if (error && !already) return { ok: false as const, error: plain(error) };
  revalidatePath('/coach', 'layout');
  return { ok: true as const, already };
}
