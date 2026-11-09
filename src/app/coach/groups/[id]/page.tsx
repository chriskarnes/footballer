import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { GroupForm } from '@/components/coach/GroupForm';
import { MemberToggle } from '@/components/coach/MemberToggle';
import { ArchiveGroup } from '@/components/coach/ArchiveGroup';
import { StatusDot, WeekDots } from '@/components/coach/WeekDots';
import { loadContent } from '@/lib/academy-data';
import { loadPlayers } from '@/lib/coach-data';
import { meetingLabel, programWeek, sessionsForWeek } from '@/lib/academy-week';
import { detailOf, localDate, byAttention } from '@/lib/progress';

export const metadata = { title: 'Group', robots: { index: false } };

/**
 * One group: this week's homework, how each player in it is getting on, and
 * who's in it. Adding a player here is all it takes to give them the week.
 */
export default async function GroupPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; sent?: string }>;
}) {
  const { id } = await params;
  const { saved, sent } = await searchParams;
  const gate = await staffOnly(`/coach/groups/${id}`);
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const [c, { players }] = await Promise.all([loadContent(db, academy.id), loadPlayers(db, academy)]);
  const g = c.groups.find((x) => x.id === id);
  if (!g) notFound();

  const today = localDate(new Date(), academy.timeZone);
  const program = c.programs.find((p) => p.id === g.program_id);
  const n = program && g.starts_on ? programWeek(g.starts_on, program.weeks, today) : null;
  const homework = program && n ? sessionsForWeek(c.sessions, program.id, n) : [];
  const ids = new Set(c.memberships.filter((m) => m.group_id === g.id).map((m) => m.user_id));
  const members = players.filter((p) => ids.has(p.user_id)).sort(byAttention);
  const others = players.filter((p) => !ids.has(p.user_id)).sort((a, b) => a.name.localeCompare(b.name));
  const when = meetingLabel(g);

  return (
    <div className="animate-pop">
      <BackLink href="/coach/groups" label="Groups" />
      {when && <p className="eyebrow mb-3">{when}</p>}
      <h1 className="h-page">{g.name}</h1>
      <p className="mt-2 text-[14px] text-on-surface-variant">
        {program
          ? n ? <><b className="font-semibold text-on-surface">{program.name}</b> · Week {n} of {program.weeks}</>
              : <>{program.name} · {g.starts_on && g.starts_on > today ? `starts ${g.starts_on}` : 'finished'}</>
          : 'No program yet. Players in it get nothing at home until it has one.'}
      </p>
      {(saved || sent) && (
        <p role="status" className="card-flat mt-4 px-4 py-3 text-[13.5px] font-semibold text-on-surface">
          {sent ? 'Note sent to the group.' : 'Saved.'}
        </p>
      )}

      {!!members.length && (
        <Link href={`/coach/send?group=${g.id}`} className="btn-ghost pressable mt-5 w-full">Send a note to the group</Link>
      )}

      {!!homework.length && (
        <section className="card mt-5 p-5">
          <div className="flex items-baseline justify-between">
            <div className="h-card">This week at home</div>
            {program && <Link href={`/coach/programs/${program.id}#week-${n}`} className="text-[13px] font-semibold text-on-surface-variant underline underline-offset-4">Edit</Link>}
          </div>
          <ul className="mt-2 space-y-1 text-[14px] text-on-surface">
            {homework.map((s) => <li key={s.id}>{s.name} <span className="text-on-surface-variant">· {s.drill_ids.length} drills</span></li>)}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <p className="eyebrow mb-3">Players · {members.length}</p>
        {members.length ? (
          <ul className="space-y-2.5">
            {members.map((p) => {
              const detail = detailOf(p.progress);
              return (
                <li key={p.user_id}>
                  <Link href={`/coach/players/${p.user_id}`} className="card pressable block py-4 pl-4 pr-3">
                    <span className="block truncate text-[15px] font-bold text-on-surface">{p.name}</span>
                    <span className="mt-1 flex items-center gap-2 text-[13px] text-on-surface-variant">
                      <StatusDot status={p.progress.status} />
                      <span className="truncate"><b className="font-semibold text-on-surface">{p.progress.reason}</b>{detail && <> · {detail}</>}</span>
                    </span>
                    <span className="mt-3 block"><WeekDots week={p.progress.week} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <p className="pl-1 text-[13.5px] text-on-surface-variant">Nobody yet. Add players below.</p>}
      </section>

      <section className="mt-8">
        <p className="eyebrow mb-3">Who&rsquo;s in it</p>
        {players.length ? (
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
        ) : <p className="pl-1 text-[13.5px] text-on-surface-variant">No players in the academy yet. Send them the invite link from Players.</p>}
      </section>

      <details className="mt-9">
        <summary className="cursor-pointer text-[14px] font-semibold text-on-surface">Name, day, program and start</summary>
        <div className="mt-5"><GroupForm group={g} programs={c.programs} today={today} /></div>
      </details>
      <ArchiveGroup id={g.id} archived={!!g.archived} />
    </div>
  );
}
