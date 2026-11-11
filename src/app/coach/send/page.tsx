import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { NoteComposer } from '@/components/coach/NoteComposer';
import { loadPlayers } from '@/lib/coach-data';
import { byAttention } from '@/lib/progress';
import { loadContent } from '@/lib/academy-data';
import { nudgeDraft } from '@/lib/nudge';

export const metadata = { title: 'Send a note', robots: { index: false } };

/**
 * Write to one player, a few, or everyone. `?to=<id>` starts with that
 * player picked; `&kind=nudge` also starts with a nudge written for them,
 * from what the dashboard knows about their week.
 */
export default async function SendPage({ searchParams }: { searchParams: Promise<{ to?: string; kind?: string; group?: string }> }) {
  const gate = await staffOnly('/coach/send');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const { to, kind, group } = await searchParams;

  const [{ players }, c] = await Promise.all([loadPlayers(db, academy, { days: 14 }), loadContent(db, academy.id)]);
  const groups = c.groups.filter((g) => !g.archived).map((g) => ({
    id: g.id, name: g.name,
    members: c.memberships.filter((m) => m.group_id === g.id && players.some((p) => p.user_id === m.user_id)).map((m) => m.user_id),
  }));
  const inGroup = groups.find((g) => g.id === group);
  players.sort(byAttention);
  const target = players.find((p) => p.user_id === to);
  const nudge = kind === 'nudge' && target;

  const draft = nudge ? nudgeDraft(target.first, target.progress) : '';

  return (
    <div className="animate-pop">
      <BackLink href={target ? `/coach/players/${target.user_id}` : inGroup ? `/coach/groups/${inGroup.id}` : '/coach'}
                label={target ? target.name : inGroup ? inGroup.name : 'Players'} />
      <h1 className="h-page">{nudge ? `Nudge ${target.first}` : target ? `Note to ${target.first}` : inGroup ? `Note to ${inGroup.name}` : 'Send a note'}</h1>
      <div className="mt-6">
        <NoteComposer
          players={players.map((p) => ({ id: p.user_id, name: p.name }))}
          groups={groups}
          initial={target ? { mode: 'players', ids: [target.user_id] } : inGroup ? { mode: 'groups', ids: [inGroup.id] } : { mode: 'everyone' }}
          fixed={nudge ? { id: target.user_id, name: target.name } : undefined}
          initialBody={draft}
          kind={nudge ? 'nudge' : 'note'}
          back={target ? `/coach/players/${target.user_id}` : inGroup ? `/coach/groups/${inGroup.id}` : '/coach'} />
      </div>
    </div>
  );
}
