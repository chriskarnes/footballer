'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { plain } from '@/lib/plain-error';
import { localDate, mondayOf } from '@/lib/progress';
import { cancelPlayerBilling, resumePlayerBilling } from '@/lib/billing-server';

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

  // "Everyone" is everyone training: not the players switched off (0040),
  // who can't open the app to read it.
  let to = input.to?.length ? input.to : null;
  if (!to) {
    const { data: members, error: me } = await v.db.from('academy_members').select('user_id, active').eq('academy_id', v.academy.id).eq('role', 'player');
    const rows = (me ? [] : members ?? []) as { user_id: string; active: boolean | null }[];
    if (rows.some((m) => m.active === false)) {
      to = rows.filter((m) => m.active !== false).map((m) => m.user_id);
      if (!to.length) return { ok: false as const, error: 'Every player is inactive, so there’s nobody to send it to.' };
    }
  }
  const { error } = await v.db.rpc('send_note', {
    p_academy: v.academy.id, p_body: body, p_to: to, p_kind: input.kind,
  });
  if (error) return { ok: false as const, error: plain(error) };

  revalidatePath('/coach', 'layout');
  // Sent from the note dialog: the page it's over stays where it is.
  return { ok: true as const };
}

/**
 * A nudge each for the players who are behind: every one their own note, as
 * if sent one at a time. One that fails (a player who left since the page
 * loaded) doesn't stop the rest; the answer says who got theirs, so trying
 * again goes only to the ones who didn't.
 */
export async function sendNudges(items: { to: string; body: string }[]): Promise<{ ok: true; sent: number } | { ok: false; error: string; sent: string[] }> {
  const v = await staff();
  if (!v) return { ok: false, error: 'Only trainers can send notes.', sent: [] };
  const list = items.filter((i) => i.to && i.body.trim()).slice(0, 200);
  if (!list.length) return { ok: false, error: 'Pick who it’s for.', sent: [] };
  const sent: string[] = [];
  let failed = 0;
  for (const i of list) {
    const { error } = await v.db.rpc('send_note', {
      p_academy: v.academy.id, p_body: i.body.trim().slice(0, 1000), p_to: [i.to], p_kind: 'nudge',
    });
    if (error) { failed++; console.error('sendNudges', error); } else sent.push(i.to);
    // Three in a row with none through: it's down, not one stale player.
    if (failed >= 3 && !sent.length) break;
  }
  revalidatePath('/coach', 'layout');
  if (sent.length < list.length) {
    const left = list.length - sent.length;
    return { ok: false, sent, error: sent.length
      ? `Sent ${sent.length}. ${left} didn’t go: they’re still ticked, so Send tries only those.`
      : 'Couldn’t send those. Try again.' };
  }
  return { ok: true, sent: sent.length };
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
  const unpaid = await cancelPlayerBilling(userId, v.academy.id);
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
  // Said, not left in a log: a family still being charged for a player who
  // is gone. A second tap tries again.
  if (unpaid.failed) return { ok: false as const, error: 'They’re removed, but their family’s card payments couldn’t be stopped. Tap Remove again; if it still says this, tell us so we can stop them.' };
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

/**
 * Switches a player off or back on (0040). Off, they stay on the roster with
 * their history, but can't open their training, aren't counted in what the
 * trainer pays, and their family's payments stop. Back on, a family that was
 * paying adds their card again.
 */
export async function setPlayerActive(userId: string, active: boolean) {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can do that.' };
  // Only for a player of this academy: the payments below are found by id.
  const { data: here } = await v.db.from('academy_members').select('user_id').eq('academy_id', v.academy.id).eq('user_id', userId).eq('role', 'player').maybeSingle();
  if (!here) return { ok: false as const, error: 'They’re not a player here any more.' };
  // Off: their family's payments are paused first, so nobody is switched off
  // and still charged. Paused, not cancelled: back on, the card carries on
  // from its next payment, with nothing to pay twice.
  if (!active && (await cancelPlayerBilling(userId, v.academy.id, 'pause')).failed) {
    return { ok: false as const, error: 'Couldn’t pause their family’s card payments, so nothing was changed. Try again in a minute.' };
  }
  const { error } = await v.db.rpc('set_player_active', { p_academy: v.academy.id, p_user: userId, p_active: active });
  if (error) return { ok: false as const, error: error.code === 'PGRST202' ? 'That isn’t switched on yet. Try again later.' : plain(error) };
  revalidatePath('/coach', 'layout');
  if (active && (await resumePlayerBilling(userId, v.academy.id)).failed) {
    return { ok: false as const, error: 'They’re active again, but their family’s card payments couldn’t be restarted. Tell us so we can.' };
  }
  return { ok: true as const };
}

/** A trainer's own note that a player has paid them, for those who collect their own way (0040). */
export async function setPlayerPaid(userId: string, paid: boolean) {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can do that.' };
  const { error } = await v.db.rpc('set_player_paid', { p_academy: v.academy.id, p_user: userId, p_paid: paid });
  if (error) return { ok: false as const, error: error.code === 'PGRST202' ? 'That isn’t switched on yet. Try again later.' : plain(error) };
  revalidatePath('/coach', 'layout');
  return { ok: true as const };
}
