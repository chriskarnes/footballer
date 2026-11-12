import Link from 'next/link';
import { staffOnly } from '@/components/coach/Gate';
import { StatusDot, WeekDots } from '@/components/coach/WeekDots';
import { InviteLink } from '@/components/coach/InviteLink';
import { JoinRequests, type JoinRequest } from '@/components/coach/JoinRequests';
import { loadContent } from '@/lib/academy-data';
import { loadPlayers } from '@/lib/coach-data';
import { ago } from '@/lib/notes';
import { byAttention, detailOf, sinceLabel } from '@/lib/progress';
import { PageHead } from '@/components/coach/PageHead';
import { NoteButton, NoteProvider } from '@/components/coach/NoteDialog';
import { nudgeDraft } from '@/lib/nudge';
import { PLAYER_VIEWS, ViewTabs } from '@/components/coach/ViewTabs';
import { TickMark } from '@/components/TickMark';
import { readSetup, setupSteps } from '@/lib/setup';

export const metadata = { title: 'Coach', robots: { index: false } };

/**
 * The trainer's front page: who needs a word from them this week.
 *
 * The headline is the count of players who need a nudge, because that's the
 * question a trainer opens this with. The list is sorted worst first, so the
 * players to act on are at the top and the Nudge button is next to them.
 */
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ sent?: string; group?: string; ready?: string }> }) {
  const gate = await staffOnly('/coach');
  if ('page' in gate) return gate.page;
  const { db, academy, role } = gate.viewer;
  const { sent, group, ready } = await searchParams;
  const [content, setup] = await Promise.all([loadContent(db, academy.id), readSetup(db, academy.id)]);
  // A new academy's owner is led back to the checklist until it's done.
  const steps = role === 'owner' && setup.ready && !setup.done ? setupSteps(setup, content) : null;

  const [{ players: all, error }, { data: invite }, { data: asking }] = await Promise.all([
    loadPlayers(db, academy, { content }),
    db.from('academy_invites').select('code').eq('academy_id', academy.id).eq('role', 'player').maybeSingle(),
    // Before 0006 runs the table isn't there; that's an error, read as none.
    db.from('join_requests').select('user_id, name, message, created_at').eq('academy_id', academy.id)
      .order('created_at', { ascending: true }),
  ]);
  all.sort(byAttention);
  // A group narrows the list (and the headline) to its players.
  const groups = content.groups.filter((g) => !g.archived);
  const inGroup = groups.find((g) => g.id === group);
  const players = inGroup
    ? all.filter((p) => content.memberships.some((m) => m.group_id === inGroup.id && m.user_id === p.user_id))
    : all;

  const needs = players.filter((p) => p.progress.status !== 'good').length;
  const trained = players.filter((p) => p.progress.done > 0).length;
  const sessions = players.reduce((a, p) => a + p.progress.done, 0);
  const minutes = players.reduce((a, p) => a + p.progress.minutesThisWeek, 0);

  // What the note dialog needs: everyone it could go to, and who's in each group.
  const notePlayers = all.map((p) => ({ id: p.user_id, name: p.name, nudge: nudgeDraft(p.first, p.progress) }));
  const noteGroups = groups.map((g) => ({
    id: g.id, name: g.name,
    members: content.memberships.filter((m) => m.group_id === g.id && all.some((p) => p.user_id === m.user_id)).map((m) => m.user_id),
  }));

  const headline = !players.length ? 'No players yet'
    : needs ? `${needs} ${needs === 1 ? 'player needs' : 'players need'} a nudge`
    : 'Everyone’s on track';

  return (
    <NoteProvider players={notePlayers} groups={noteGroups}>
    <div className="animate-pop">
      <ViewTabs tabs={PLAYER_VIEWS} on="/coach" />
      <PageHead title={headline}
                action={<>
                  {!!players.length && (
                    <NoteButton group={inGroup?.id} className="btn-ghost btn-sm pressable">Send a note</NoteButton>
                  )}
                  {!!all.length && <Link href="/coach/team#invite" className="btn-primary btn-sm pressable">Invite players</Link>}
                </>}>
        {!!players.length && <>
          This week: <b className="font-semibold text-on-surface">{trained} of {players.length}</b> trained
          {' · '}{sessions} {sessions === 1 ? 'session' : 'sessions'} · {minutes} min
        </>}
      </PageHead>

      {steps && (
        <section className="card mt-5 flex items-center gap-4 p-5 lg:max-w-xl">
          <span className="shrink-0"><TickMark on={false} here /></span>
          <div className="min-w-0 flex-1">
            <div className="h-card">Finish setting up {academy.name}</div>
            <p className="mt-0.5 text-[14px] text-on-surface-variant">{steps.filter(Boolean).length} of 5 done</p>
          </div>
          <Link href="/coach/setup" className="btn-primary btn-sm pressable shrink-0">Continue</Link>
        </section>
      )}
      {ready && (
        <p role="status" className="card-flat mt-4 px-4 py-3 text-[13.5px] font-semibold text-on-surface">
          {academy.name} is open. Players can find you by name in Find your trainer.
        </p>
      )}

      {sent && (
        <p role="status" className="card-flat mt-4 px-4 py-3 text-[13.5px] font-semibold text-on-surface">
          Note sent. Players see it next time they open the app.
        </p>
      )}

      {!!asking?.length && <JoinRequests requests={(asking as Omit<JoinRequest, 'when'>[]).map((r) => ({ ...r, when: ago(r.created_at) }))} />}

      {!!groups.length && (
        <nav className="scroll-x -mx-5 mt-6 flex gap-2 px-5 lg:mx-0 lg:flex-wrap lg:px-0" aria-label="Filter by group">
          <Link href="/coach" className={`chip shrink-0 ${!inGroup ? 'chip-on' : ''}`}>Everyone</Link>
          {groups.map((g) => (
            <Link key={g.id} href={`/coach?group=${g.id}`} className={`chip shrink-0 ${inGroup?.id === g.id ? 'chip-on' : ''}`}>{g.name}</Link>
          ))}
        </nav>
      )}

      {error && <p className="mt-4 text-[13px] text-on-surface-variant">Couldn&rsquo;t load players: {error}</p>}

      {/* Phone: cards, worst first. */}
      <ul className="mt-6 space-y-2.5 lg:hidden">
        {players.map((p) => {
          const detail = detailOf(p.progress);
          return (
            <li key={p.user_id} className="card flex items-center gap-3 py-4 pl-4 pr-3">
              <Link href={`/coach/players/${p.user_id}`} className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-on-surface">{p.name}</span>
                {!inGroup && !!p.groups.length && (
                  <span className="block truncate text-[12px] font-semibold text-on-surface-variant">{p.groups.join(' · ')}</span>
                )}
                <span className="mt-1 flex items-center gap-2 text-[13px] text-on-surface-variant">
                  <StatusDot status={p.progress.status} />
                  <span className="truncate">
                    <span className="font-semibold text-on-surface">{p.progress.reason}</span>
                    {detail && <> · {detail}</>}
                  </span>
                </span>
                <span className="mt-3 block"><WeekDots week={p.progress.week} /></span>
              </Link>
              {p.progress.status !== 'good' && (
                <NoteButton to={p.user_id} kind="nudge" className="btn-ghost btn-sm pressable shrink-0">Nudge</NoteButton>
              )}
            </li>
          );
        })}
      </ul>

      {/* Laptop: the roster as a table, still worst first. */}
      {!!players.length && (
        <div className="card mt-6 hidden overflow-hidden lg:block">
          <table className="w-full text-left text-[14px]">
            <thead className="border-b border-outline-variant text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">
              <tr><Th>Player</Th><Th>Groups</Th><Th>This week</Th><Th>Status</Th><Th>Last trained</Th><Th><span className="sr-only">Actions</span></Th></tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {players.map((p) => {
                const detail = detailOf(p.progress);
                return (
                  <tr key={p.user_id} className="relative hover:bg-surface-container-low">
                    <td className="px-5 py-3.5 font-bold text-on-surface">
                      <Link href={`/coach/players/${p.user_id}`} className="after:absolute after:inset-0">{p.name}</Link>
                    </td>
                    <td className="max-w-[14rem] truncate px-5 py-3.5 text-[13px] text-on-surface-variant">{p.groups.join(', ') || '—'}</td>
                    <td className="px-5 py-3.5"><WeekDots week={p.progress.week} /></td>
                    <td className="px-5 py-3.5 text-[13px] text-on-surface-variant">
                      <span className="flex items-center gap-2">
                        <StatusDot status={p.progress.status} />
                        <span><b className="font-semibold text-on-surface">{p.progress.reason}</b>{detail && <> · {detail}</>}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-on-surface-variant">{sinceLabel(p.progress.daysSince)}</td>
                    <td className="relative z-10 px-5 py-3.5 text-right">
                      {p.progress.status !== 'good' && (
                        <NoteButton to={p.user_id} kind="nudge" className="btn-ghost btn-sm pressable">Nudge</NoteButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* The invite link leads only while there's nobody to list; after that it lives under Academy. */}
      {!all.length && (
        <section className="mt-6 lg:max-w-xl">
          <div className="card p-5">
            <div className="h-card">Invite your players</div>
            <p className="mt-1 text-[13.5px] leading-snug text-on-surface-variant">
              Text this link to a player or a parent. They sign in with their email and appear here.
            </p>
            {invite?.code
              ? <InviteLink path={`/join/${invite.code}`} role="player" canRotate={false} />
              : <p className="mt-3 text-[13px]">No invite link yet.</p>}
          </div>
        </section>
      )}
    </div>
    </NoteProvider>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-5 py-3 font-semibold">{children}</th>;
}
