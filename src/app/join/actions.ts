'use server';
import { readProfileMissing } from '@/lib/profile-check';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { getAcademy } from '@/lib/branding-server';

/**
 * Joins with the code; the database decides the role. Trainers land on their
 * players. `who` is whose email this is, the player's or a parent's; it is
 * kept on the profile, and skipped quietly if migration 0009 hasn't run.
 */
export async function joinAcademy(code: string, who?: 'player' | 'parent') {
  const db = await serverClient();
  let { data, error } = await db.rpc('join_academy', { p_code: code });
  // Two taps (or two tabs) at once: the second insert hits the first one's
  // row. They're in, so ask again, which finds them there.
  if (error?.code === '23505') ({ data, error } = await db.rpc('join_academy', { p_code: code }));
  if (error) {
    console.error('join_academy', error);
    return { ok: false as const, error: /not found|invalid/i.test(error.message)
      ? ((await getAcademy().catch(() => null))?.academy?.selfServe
        ? 'This invite link has changed. Ask whoever sent it for the current one.'
        : 'This invite link has changed. Ask your trainer for the current one.')
      : /not signed in/i.test(error.message) ? 'You’ve been signed out. Sign in again, then tap Join.'
      // 0029: one account is one person here, and this one has asked to play.
      : /asked as a player/i.test(error.message) ? 'This account has asked to join as a player. To train here too, open this link signed in with your own email.'
      : 'Couldn’t join just now. Try again.' };
  }
  // A trainer link asks the owner (0027): it isn't a key to every player's data.
  if ((data as { role: string }).role === 'asked') return { ok: true as const, asked: true };
  const { data: { user } } = await db.auth.getUser();
  // Whose email this is belongs to the account. A trainer joining another
  // academy for their own child keeps theirs: their players know them by it.
  if (user && (who === 'player' || who === 'parent')) {
    const { data: staffSomewhere } = await db.from('academy_members').select('role').eq('user_id', user.id).in('role', ['owner', 'trainer']).limit(1);
    // It's said once, for the account: a child who joined one academy as the
    // player stays the player when a parent's link to another is opened on
    // the same account. Only an empty one is filled in.
    if (!staffSomewhere?.length) {
      const { data: p, error: pe } = await db.from('profiles').select('signed_up_by').eq('id', user.id).maybeSingle();
      if (!pe && !(p as { signed_up_by: string | null } | null)?.signed_up_by) {
        await db.from('profiles').upsert({ id: user.id, signed_up_by: who });
      }
    }
  }
  if ((data as { role: string }).role !== 'player') redirect('/coach');
  // A new player is asked their name (and the rest) first, on Me; their
  // trainer sees that name, not an email address. A name alone isn't enough:
  // one let in from a join request has the name they asked with, and nothing else.
  redirect(user && !(await readProfileMissing(db, user.id)) ? '/?joined=1' : '/me');
}

/**
 * One tap into an open self-serve space (0030): no trainer to ask. A closed
 * one is joined by its invite link, as any academy is.
 */
export async function joinSelfServe() {
  const db = await serverClient();
  const { academy } = await getAcademy();
  if (!academy?.selfServe) return { ok: false as const, error: 'This isn’t a space you can join on your own.' };
  const { error } = await db.rpc('join_self_serve', { p_slug: academy.slug });
  if (error) {
    console.error('join_self_serve', error);
    return { ok: false as const, error: /not signed in/i.test(error.message) ? 'You’ve been signed out. Sign in again, then tap Start.'
      : /not open/i.test(error.message) ? 'It’s invite-only for now. Open the link you were sent.'
      : 'Couldn’t start just now. Try again.' };
  }
  const { data: { user } } = await db.auth.getUser();
  redirect(user && !(await readProfileMissing(db, user.id)) ? '/?joined=1' : '/me');
}
