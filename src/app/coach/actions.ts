'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';

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

export async function sendNote(input: { body: string; to: string[] | null; kind: 'note' | 'nudge'; back?: string }) {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can send notes.' };
  const body = input.body.trim();
  if (!body) return { ok: false as const, error: 'Write something first.' };
  if (body.length > 1000) return { ok: false as const, error: 'Keep it under 1,000 characters.' };

  const { error } = await v.db.rpc('send_note', {
    p_academy: v.academy.id, p_body: body, p_to: input.to?.length ? input.to : null, p_kind: input.kind,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/coach', 'layout');
  // Sent from the dialog: the page it's over stays where it is.
  if (input.back === undefined) return { ok: true as const };
  // Back where they came from, with the confirmation. Only our own pages.
  const back = /^\/coach(\/[\w/-]*)?$/.test(input.back) ? input.back : '/coach';
  redirect(`${back}?sent=1`);
}

export async function rotateInvite(role: 'player' | 'trainer') {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can do that.' };
  const { data, error } = await v.db.rpc('rotate_invite', { p_academy: v.academy.id, p_role: role });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/coach', 'layout');
  return { ok: true as const, code: data as string };
}

export async function removeMember(userId: string) {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can do that.' };
  // RLS decides: staff remove players, only the owner removes a trainer.
  const { error, count } = await v.db.from('academy_members')
    .delete({ count: 'exact' }).eq('academy_id', v.academy.id).eq('user_id', userId);
  if (error) return { ok: false as const, error: error.message };
  if (!count) return { ok: false as const, error: 'You can’t remove that person.' };
  revalidatePath('/coach', 'layout');
  return { ok: true as const };
}

/** Let a player in who asked to join, or turn them away. */
export async function answerJoinRequest(userId: string, approve: boolean) {
  const v = await staff();
  if (!v) return { ok: false as const, error: 'Only trainers can do that.' };
  const { error } = await v.db.rpc('answer_join_request', { p_academy: v.academy.id, p_user: userId, p_approve: approve });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/coach', 'layout');
  return { ok: true as const };
}
