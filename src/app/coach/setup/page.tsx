import { redirect } from 'next/navigation';
import { staffOnly } from '@/components/coach/Gate';
import { SetupChecklist } from '@/components/coach/SetupChecklist';
import { loadContent } from '@/lib/academy-data';
import { readSetup } from '@/lib/setup';

export const metadata = { title: 'Set up', robots: { index: false } };

/**
 * A new academy's first hour, for its owner: who they are to their players,
 * a few drills, a session, a program, then the link for their players. Each
 * step is done by what the academy has in it, except the first (saved here)
 * and the last (the button), so it can't fall out of step with the pages it
 * sends them to. Those are the ordinary editors; the dashboard leads back.
 */
export default async function SetupPage() {
  const gate = await staffOnly('/coach/setup');
  if ('page' in gate) return gate.page;
  const v = gate.viewer;
  if (v.role !== 'owner') redirect('/coach');

  const [content, s, { data: profile }, { data: invite }, { count: players }] = await Promise.all([
    loadContent(v.db, v.academy.id),
    readSetup(v.db, v.academy.id),
    v.db.from('profiles').select('display_name, avatar_updated_at').eq('id', v.user.id).maybeSingle(),
    v.db.from('academy_invites').select('code').eq('academy_id', v.academy.id).eq('role', 'player').maybeSingle(),
    v.db.from('academy_members').select('user_id', { count: 'exact', head: true }).eq('academy_id', v.academy.id).eq('role', 'player'),
  ]);
  return (
    <SetupChecklist name={v.academy.name} email={v.user.email ?? ''} setup={s} content={content}
      profile={{ name: profile?.display_name ?? '', photoAt: profile?.avatar_updated_at ?? null }}
      invite={invite?.code ?? null} players={players ?? 0} />
  );
}
