import Link from 'next/link';
import { shortDate } from '@/lib/dates';
import { staffOnly } from '@/components/coach/Gate';
import { Pending } from '@/components/coach/Pending';
import { StatusDot } from '@/components/coach/WeekDots';
import { PageHead } from '@/components/coach/PageHead';
import { loadContent } from '@/lib/academy-data';
import { loadPlayers } from '@/lib/coach-data';
import { LoadFailed } from '@/components/coach/LoadFailed';
import { meetingLabel, programWeek } from '@/lib/academy-week';
import { localDate } from '@/lib/progress';
import { Empty } from '@/components/coach/Empty';

export const metadata = { title: 'Groups', robots: { index: false } };

/**
 * The academy's groups. A group is a label: players can be in several, and
 * each one brings its program's week with it.
 */
export default async function GroupsPage() {
  const gate = await staffOnly('/coach/groups');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const [c, { players, error }] = await Promise.all([loadContent(db, academy.id), loadPlayers(db, academy)]);
  if (error) return <LoadFailed title="Groups" path="/coach/groups" />;
  const today = localDate(new Date(), academy.timeZone);
  const active = c.groups.filter((g) => !g.archived);
  const archived = c.groups.filter((g) => g.archived);
  const inAny = new Set(c.memberships.map((m) => m.user_id));
  const solo = players.filter((p) => !inAny.has(p.user_id)).length;

  return (
    <div className="animate-pop">
      {!c.ready && <Pending />}

      <PageHead title="Groups"
                action={<Link href="/coach/groups/new" className="btn-primary btn-sm pressable">New group</Link>} />
      <div className="mt-6" />

      {active.length ? (
        <ul className="grid gap-2.5 lg:grid-cols-2">
          {active.map((g) => {
            const members = players.filter((p) => c.memberships.some((m) => m.group_id === g.id && m.user_id === p.user_id));
            const behind = members.filter((p) => p.progress.status !== 'good').length;
            const program = c.programs.find((p) => p.id === g.program_id);
            const n = program && g.starts_on ? programWeek(g.starts_on, program.weeks, today) : null;
            const when = meetingLabel(g);
            return (
              <li key={g.id}>
                <Link href={`/coach/groups/${g.id}`} className="card pressable block p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-body-lg font-bold text-on-surface">{g.name}</span>
                    <span className="shrink-0 text-body-sm text-on-surface-variant">{members.length} {members.length === 1 ? 'player' : 'players'}</span>
                  </div>
                  <p className="mt-1 text-body text-on-surface-variant">
                    {[when, program ? (n ? `${program.name} · Week ${n} of ${program.weeks}` : `${program.name} · ${g.starts_on && g.starts_on > today ? `starts ${shortDate(g.starts_on)}` : 'finished'}`) : 'No program'].filter(Boolean).join(' · ')}
                  </p>
                  {!!members.length && (
                    <p className="mt-2.5 flex items-center gap-2 text-body font-semibold text-on-surface">
                      <StatusDot status={behind ? 'warn' : 'good'} />
                      {behind ? `${behind} behind this week` : 'All on track'}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="No groups yet" href="/coach/groups/new" cta="Make a group">
          A group is players who train together, like &ldquo;U12 Tuesday&rdquo;. Give it a program and everyone in it gets that week&rsquo;s homework. A player can be in more than one.
        </Empty>
      )}

      {!!players.length && !!solo && !!active.length && (
        <p className="mt-4 pl-1 text-body text-on-surface-variant">
          {solo ? `${solo} ${solo === 1 ? 'player isn’t' : 'players aren’t'} in a group yet.` : ''}
        </p>
      )}

      {!!archived.length && (
        <details className="mt-8">
          <summary className="cursor-pointer text-body font-semibold text-on-surface-variant">Finished groups · {archived.length}</summary>
          <ul className="card mt-3 divide-y divide-outline-variant">
            {archived.map((g) => (
              <li key={g.id}><Link href={`/coach/groups/${g.id}`} className="block px-4 py-3 text-body font-semibold text-on-surface">{g.name}</Link></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
