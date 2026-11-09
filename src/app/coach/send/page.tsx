import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { NoteComposer } from '@/components/coach/NoteComposer';
import { loadPlayers } from '@/lib/coach-data';
import { byAttention } from '@/lib/progress';

export const metadata = { title: 'Send a note', robots: { index: false } };

/**
 * Write to one player, a few, or everyone. `?to=<id>` starts with that
 * player picked; `&kind=nudge` also starts with a nudge written for them,
 * from what the dashboard knows about their week.
 */
export default async function SendPage({ searchParams }: { searchParams: Promise<{ to?: string; kind?: string }> }) {
  const gate = await staffOnly('/coach/send');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const { to, kind } = await searchParams;

  const { players } = await loadPlayers(db, academy, { days: 14 });
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
      <BackLink href={target ? `/coach/players/${target.user_id}` : '/coach'} label={target ? target.name : 'Players'} />
      <h1 className="h-page">{nudge ? `Nudge ${target.first}` : target ? `Note to ${target.first}` : 'Send a note'}</h1>
      <p className="mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-on-surface-variant">
        Players see it in the app and can&rsquo;t reply. Every trainer at {academy.name} can see what&rsquo;s sent.
      </p>
      <NoteComposer
        players={players.map((p) => ({ id: p.user_id, name: p.name }))}
        initialTo={target ? [target.user_id] : []}
        initialBody={draft}
        kind={nudge ? 'nudge' : 'note'}
        back={target ? `/coach/players/${target.user_id}` : '/coach'} />
    </div>
  );
}
