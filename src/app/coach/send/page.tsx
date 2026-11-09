import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { NoteComposer } from '@/components/coach/NoteComposer';
import { loadPlayers } from '@/lib/coach-data';
import { byAttention } from '@/lib/progress';
import { loadContent } from '@/lib/academy-data';

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

  let draft = '';
  if (nudge) {
    const pr = target.progress;
    draft = pr.daysSince === null
      ? `Hi ${target.first}, your first session is waiting. Even 15 minutes today gets you started.`
      : pr.daysSince >= 7
        ? `Hi ${target.first}, haven’t seen you train in ${pr.daysSince} days. 15 minutes today is plenty to get going again.`
        : `Hi ${target.first}, you’re ${pr.due - pr.done} behind this week. Can you fit one in today?`;
  }

  return (
    <div className="animate-pop">
      <BackLink href={target ? `/coach/players/${target.user_id}` : inGroup ? `/coach/groups/${inGroup.id}` : '/coach'}
                label={target ? target.name : inGroup ? inGroup.name : 'Players'} />
      <h1 className="h-page">{nudge ? `Nudge ${target.first}` : target ? `Note to ${target.first}` : inGroup ? `Note to ${inGroup.name}` : 'Send a note'}</h1>
      <p className="mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-on-surface-variant">
        Players see it in the app and can&rsquo;t reply. Every trainer at {academy.name} can see what&rsquo;s sent.
      </p>
      <NoteComposer
        players={players.map((p) => ({ id: p.user_id, name: p.name }))}
        groups={groups}
        initialTo={target ? [target.user_id] : inGroup ? inGroup.members : []}
        initialBody={draft}
        kind={nudge ? 'nudge' : 'note'}
        back={target ? `/coach/players/${target.user_id}` : inGroup ? `/coach/groups/${inGroup.id}` : '/coach'} />
    </div>
  );
}
