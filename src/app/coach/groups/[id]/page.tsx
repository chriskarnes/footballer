import Link from 'next/link';
import { shortDate } from '@/lib/dates';
import { notFound } from 'next/navigation';
import { staffOnly } from '@/components/coach/Gate';
import { GroupForm } from '@/components/coach/GroupForm';
import { MemberToggle } from '@/components/coach/MemberToggle';
import { ArchiveGroup } from '@/components/coach/ArchiveGroup';
import { Disclose } from '@/components/coach/Disclose';
import { NoteButton, NoteProvider } from '@/components/coach/NoteDialog';
import { StatusDot, WeekDots } from '@/components/coach/WeekDots';
import { loadContent } from '@/lib/academy-data';
import { loadPlayers } from '@/lib/coach-data';
import { LoadFailed } from '@/components/coach/LoadFailed';
import { meetingLabel, programWeek, sessionsForWeek } from '@/lib/academy-week';
import { detailOf, localDate, byAttention } from '@/lib/progress';
import { PageHead } from '@/components/coach/PageHead';

export const metadata = { title: 'Group', robots: { index: false } };

/**
 * One group: this week's homework, how each player in it is getting on, and
 * who's in it. Adding a player here is all it takes to give them the week.
 */
export default async function GroupPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gate = await staffOnly(`/coach/groups/${id}`);
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const [c, { players, error }] = await Promise.all([loadContent(db, academy.id), loadPlayers(db, academy)]);
  const g = c.groups.find((x) => x.id === id);
  if (!g) notFound();
  if (error) return <LoadFailed title={g.name} path={`/coach/groups/${id}`} back={{ href: '/coach/groups', label: 'Groups' }} />;

  const today = localDate(new Date(), academy.timeZone);
  const program = c.programs.find((p) => p.id === g.program_id);
  const n = program && g.starts_on ? programWeek(g.starts_on, program.weeks, today) : null;
  const homework = program && n ? sessionsForWeek(c.sessions, program.id, n) : [];
  const ids = new Set(c.memberships.filter((m) => m.group_id === g.id).map((m) => m.user_id));
  const members = players.filter((p) => ids.has(p.user_id)).sort(byAttention);
  const others = players.filter((p) => !ids.has(p.user_id)).sort((a, b) => a.name.localeCompare(b.name));
  const when = meetingLabel(g);

  const meta = [when, program
    ? n ? `${program.name} · Week ${n} of ${program.weeks}`
        : `${program.name} · ${g.starts_on && g.starts_on > today ? `starts ${shortDate(g.starts_on)}` : 'finished'}`
    : null].filter(Boolean).join(' · ');

  // This group stays on the list even when finished: Send a note here is to it,
  // and without it the note fell back to Everyone.
  const noteGroups = c.groups.filter((x) => !x.archived || x.id === g.id).map((x) => ({
    id: x.id, name: x.name,
    members: c.memberships.filter((m) => m.group_id === x.id && players.some((p) => p.user_id === m.user_id)).map((m) => m.user_id),
  }));

  return (
    <NoteProvider players={players.map((p) => ({ id: p.user_id, name: p.name }))} groups={noteGroups}>
    <div className="animate-pop">
      <PageHead back={{ href: '/coach/groups', label: 'Groups' }} title={g.name}
                action={!!members.length && <NoteButton group={g.id} className="btn-ghost btn-sm pressable">Send a note</NoteButton>}>
        {g.archived && <><b className="font-semibold text-on-surface">Finished</b>{meta && ' · '}</>}
        {meta}{!program && !g.archived && <>{meta && ' · '}<b className="font-semibold text-on-surface">No program yet</b>, so players get nothing at home.</>}
      </PageHead>

      {!!homework.length && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="eyebrow">This week at home</p>
            {program && <Link href={`/coach/programs/${program.id}#week-${n}`} className="text-body font-semibold text-on-surface-variant underline underline-offset-4">Edit</Link>}
          </div>
          <ul className="card divide-y divide-outline-variant">
            {homework.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 text-body">
                <span className="min-w-0 truncate font-semibold text-on-surface">{s.name}</span>
                <span className="shrink-0 text-body text-on-surface-variant">{s.drill_ids.length} {s.drill_ids.length === 1 ? 'drill' : 'drills'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* One list of who's in it and how they're doing; the tick-list to change it opens underneath. */}
      <section className="mt-8">
        <p className="eyebrow mb-3">Players · {members.length}</p>
        {!!members.length && (
          <ul className="card divide-y divide-outline-variant">
            {members.map((p) => {
              const detail = detailOf(p.progress);
              return (
                <li key={p.user_id}>
                  <Link href={`/coach/players/${p.user_id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-container-low">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-lg font-bold text-on-surface">{p.name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-body text-on-surface-variant">
                        <StatusDot status={p.progress.status} />
                        <span className="truncate"><b className="font-semibold text-on-surface">{p.progress.reason}</b>{detail && <> · {detail}</>}</span>
                      </span>
                    </span>
                    <span className="shrink-0"><WeekDots week={p.progress.week} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {players.length ? (
          <div className="mt-3">
            <Disclose label="Add or remove players" startOpen={!members.length}>
            <div className="card divide-y divide-outline-variant">
              {[...members, ...others].map((p) => {
                const elsewhere = c.groups.filter((x) => x.id !== g.id && !x.archived
                  && c.memberships.some((m) => m.group_id === x.id && m.user_id === p.user_id)).map((x) => x.name);
                return (
                  <MemberToggle key={p.user_id} groupId={g.id} userId={p.user_id} name={p.name}
                                initial={ids.has(p.user_id)} detail={elsewhere.length ? `Also in ${elsewhere.join(', ')}` : undefined} />
                );
              })}
            </div>
            </Disclose>
          </div>
        ) : <p className="pl-1 text-body text-on-surface-variant">No players in the academy yet. Invite them from Academy.</p>}
      </section>

      <section className="mt-8">
        <Disclose label="Group settings">
          <div className="card p-5">
            <GroupForm group={g} programs={c.programs} today={today} />
            <ArchiveGroup id={g.id} name={g.name} archived={!!g.archived} />
          </div>
        </Disclose>
      </section>
    </div>
    </NoteProvider>
  );
}
