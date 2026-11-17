import { rosterMarks } from '@/lib/membership-server';
import { Roster, type RosterRow } from '@/components/coach/Roster';
import { NudgeAll } from '@/components/coach/NudgeAll';
import Link from 'next/link';
import { GroupGone } from '@/components/coach/GroupGone';
import { staffOnly } from '@/components/coach/Gate';
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
import { YourName } from '@/components/coach/YourName';

export const metadata = { title: 'Players', robots: { index: false } };

/**
 * The trainer's front page: who needs a word from them this week.
 *
 * The headline is the count of players who need a nudge, because that's the
 * question a trainer opens this with. The list is sorted worst first, so the
 * players to act on are at the top and the Nudge button is next to them.
 */
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ group?: string; ready?: string }> }) {
  const gate = await staffOnly('/coach');
  if ('page' in gate) return gate.page;
  const { db, academy, role, user } = gate.viewer;
  const { group, ready } = await searchParams;
  const [content, setup] = await Promise.all([loadContent(db, academy.id), readSetup(db, academy.id)]);
  // A new academy's owner is led back to the checklist until it's done.
  const steps = role === 'owner' && setup.ready && !setup.done ? setupSteps(setup, content) : null;

  // Who's paying, who isn't, and who's switched off (0038, 0040).
  const { marks } = await rosterMarks(db, academy.id);
  const [{ players: all, error }, { data: invite }, { data: asking }, { data: me }] = await Promise.all([
    loadPlayers(db, academy, { content }),
    db.from('academy_invites').select('code').eq('academy_id', academy.id).eq('role', 'player').maybeSingle(),
    // Before 0006 runs the table isn't there; that's an error, read as none.
    db.from('join_requests').select('*').eq('academy_id', academy.id)
      .order('created_at', { ascending: true }),
    user ? db.from('profiles').select('display_name').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // A trainer invited in has no name yet; the owner gives theirs in setup.
  const askName = !steps && !me?.display_name;
  all.sort(byAttention);
  // Declined ones are kept (0027) so the asker is told; they aren't asking.
  // A trainer already here who asked through the trainer link still is.
  const waiting = ((asking ?? []) as (Omit<JoinRequest, 'when'> & { declined_at?: string | null })[])
    .filter((r) => !r.declined_at && (r.role === 'trainer' || !all.some((p) => p.user_id === r.user_id)));
  // A group narrows the list (and the headline) to its players.
  const groups = content.groups.filter((g) => !g.archived);
  const inGroup = groups.find((g) => g.id === group);
  const players = inGroup
    ? all.filter((p) => content.memberships.some((m) => m.group_id === inGroup.id && m.user_id === p.user_id))
    : all;

  // Switched off (0040): on the list, not training, so not behind either.
  const isActive = (id: string) => marks.get(id)?.active !== false;
  const training = players.filter((p) => isActive(p.user_id));
  const behind = training.filter((p) => p.progress.status !== 'good');
  const needs = behind.length;
  // All three count all training this week (set sessions, Speed, their own),
  // so they agree: "3 of 12 trained · 5 sessions · 140 min".
  const thisWeek = (p: (typeof players)[number]) => p.progress.weeks[3]?.done ?? 0;
  const trained = players.filter((p) => thisWeek(p) > 0 || p.progress.minutesThisWeek > 0).length;
  // Last week, whole, beside this week so far: said as it is, not as up or down.
  const lastWeek = (p: (typeof players)[number]) => p.progress.weeks[2]?.done ?? 0;
  const trainedLast = players.filter((p) => lastWeek(p) > 0).length;
  const sessionsLast = players.reduce((a, p) => a + lastWeek(p), 0);
  const rows: RosterRow[] = players.map((p) => {
    const m = marks.get(p.user_id);
    return {
      id: p.user_id, name: p.name, groups: p.groups,
      status: p.progress.status, reason: p.progress.reason, detail: detailOf(p.progress),
      since: sinceLabel(p.progress.daysSince), daysSince: p.progress.daysSince, week: p.progress.week,
      pay: m?.label ? { label: m.label, active: m.active, attention: m.attention } : m && !m.active ? { label: 'Inactive', active: false, attention: false } : null,
    };
  });
  const sessions = players.reduce((a, p) => a + thisWeek(p), 0);
  const minutes = players.reduce((a, p) => a + p.progress.minutesThisWeek, 0);

  // What the note dialog needs: everyone it could go to, and who's in each group.
  const notePlayers = all.map((p) => ({ id: p.user_id, name: p.name, nudge: nudgeDraft(p.first, p.progress) }));
  const noteGroups = groups.map((g) => ({
    id: g.id, name: g.name,
    members: content.memberships.filter((m) => m.group_id === g.id && all.some((p) => p.user_id === m.user_id)).map((m) => m.user_id),
  }));

  // A failed load isn't an empty academy: no "No players yet", no invite card.
  const headline = error ? 'Couldn’t load your players'
    : !players.length ? (inGroup ? `No one in ${inGroup.name} yet` : 'No players yet')
    : needs ? `${needs} ${needs === 1 ? 'player needs' : 'players need'} a nudge`
    : 'Everyone’s on track';

  return (
    <NoteProvider players={notePlayers} groups={noteGroups}>
    <div className="animate-pop">
      <ViewTabs tabs={PLAYER_VIEWS} on="/coach" query={inGroup ? `group=${inGroup.id}` : undefined} />
      <PageHead title={headline}
                action={<>
                  <NudgeAll people={behind.map((p) => ({ id: p.user_id, name: p.name, body: nudgeDraft(p.first, p.progress) }))} />
                  {!!players.length && (
                    <NoteButton group={inGroup?.id} className="btn-ghost btn-sm pressable">Send a note</NoteButton>
                  )}
                  {!!all.length && <Link href="/coach/team#invite" className="btn-primary btn-sm pressable">Invite players</Link>}
                </>}>
        {!!players.length && <>
          This week: <b className="font-semibold text-on-surface">{trained} of {players.length}</b> trained
          {' · '}{sessions} {sessions === 1 ? 'session' : 'sessions'} · {minutes} min
          {sessionsLast > 0 && <> · last week {trainedLast} trained, {sessionsLast} {sessionsLast === 1 ? 'session' : 'sessions'}</>}
        </>}
      </PageHead>

      {steps && (
        <section className="card mt-5 flex items-center gap-4 p-5 lg:max-w-xl">
          <span className="shrink-0"><TickMark on={false} here /></span>
          <div className="min-w-0 flex-1">
            <div className="h-card">Finish setting up {academy.name}</div>
            <p className="mt-0.5 text-body text-on-surface-variant">{steps.filter(Boolean).length} of {steps.length} done</p>
          </div>
          <Link href="/coach/setup" className="btn-primary btn-sm pressable shrink-0">Continue</Link>
        </section>
      )}
      {askName && <YourName />}
      {ready && (
        <p role="status" className="card-flat mt-4 px-4 py-3 text-body font-semibold text-on-surface lg:max-w-xl">
          {ready === 'link'
            ? `${academy.name} is set up. Send your invite link and players join from it.`
            : `${academy.name} is set up. Players can find you by name in Find your trainer, or join from your invite link.`}
          {' '}When they join, put them in a group with your program.
        </p>
      )}


      {/* Anyone who has since joined by link isn't asking any more (0022 clears
          these; this covers a database that hasn't run it). */}
      {!!waiting.length && <JoinRequests owner={role === 'owner'} requests={waiting.map((r) => ({ ...r, when: ago(r.created_at, academy.timeZone) }))} />}

      {!!groups.length && (
        <nav className="scroll-x -mx-5 mt-6 flex gap-2 px-5 lg:mx-0 lg:flex-wrap lg:px-0" aria-label="Filter by group">
          <Link href="/coach" className={`chip shrink-0 ${!inGroup ? 'chip-on' : ''}`}>Everyone</Link>
          {groups.map((g) => (
            <Link key={g.id} href={`/coach?group=${g.id}`} className={`chip shrink-0 ${inGroup?.id === g.id ? 'chip-on' : ''}`}>{g.name}</Link>
          ))}
        </nav>
      )}
      <GroupGone group={group} groups={content.groups} />

      {error && <p className="mt-4 text-body text-on-surface-variant">Couldn&rsquo;t load your players. Refresh to try again.</p>}

      {!!players.length && <Roster rows={rows} showGroups={!inGroup} />}

      {/* The invite link leads only while there's nobody to list; after that it lives under Academy. */}
      {!all.length && !error && (
        <section className="mt-6 lg:max-w-xl">
          <div className="card p-5">
            <div className="h-card">Invite your players</div>
            <p className="mt-1 text-body leading-snug text-on-surface-variant">
              Text this link to a player or a parent. They sign in with their email and appear here.
            </p>
            {invite?.code
              ? <InviteLink path={`/join/${invite.code}`} role="player" canRotate={false} />
              : <p className="mt-3 text-body">No invite link yet.</p>}
          </div>
        </section>
      )}
    </div>
    </NoteProvider>
  );
}
