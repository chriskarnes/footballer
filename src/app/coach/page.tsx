import { rosterMarks } from '@/lib/membership-server';
import { billingOn } from '@/lib/billing-server';
import { dollars, isLive, monthlyCents } from '@/lib/billing';
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
 * question a trainer opens this with: the ones in red, who have gone quiet,
 * never started or missed two sessions. A player one session behind isn't
 * counted: mid-week that's most of a roster, and "15 players need a nudge"
 * of 17 says nothing. The list is sorted worst first, so the players to act
 * on are at the top and the Nudge button is next to them.
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
  const { terms, marks } = await rosterMarks(db, academy.id);
  // Where the trainer pays (0037): the owner's own billing, to say when a card is due.
  const billing = role === 'owner' && terms?.mode === 'trainer_pays' && billingOn()
    ? await db.from('academy_billing').select('status, free_until').eq('academy_id', academy.id).maybeSingle()
        .then((r: { data: { status: string | null; free_until: string | null } | null; error: unknown }) => (r.error ? null : r.data ?? { status: null, free_until: null }), () => null)
    : null;
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
  // The owner is told when their card is due: free time over (or never
  // given), players training, and nothing on file. Nothing is locked.
  const freeLeft = !!billing?.free_until && Date.parse(`${billing.free_until}T23:59:59Z`) > Date.now();
  const cardDue = !billing || inGroup ? null
    : ['past_due', 'unpaid'].includes(billing.status ?? '') ? 'failed' as const
    : !isLive(billing.status) && !freeLeft && all.some((p) => isActive(p.user_id)) ? 'add' as const : null;
  // The headline's count is the red ones. Nudge all still goes to everyone
  // behind, and says how many that is.
  const needs = behind.filter((p) => p.progress.status === 'bad').length;
  // "A session behind" is only true of players with a week set; a player
  // with none who's gone a few days without training is amber too.
  const oneBehind = behind.every((p) => p.progress.hasPlan);
  // Any training this week counts (set sessions, Speed, their own).
  const thisWeek = (p: (typeof players)[number]) => p.progress.weeks[3]?.done ?? 0;
  const trained = training.filter((p) => thisWeek(p) > 0 || p.progress.minutesThisWeek > 0).length;
  const rows: RosterRow[] = players.map((p) => {
    const m = marks.get(p.user_id);
    return {
      id: p.user_id, name: p.name, groups: p.groups,
      status: p.progress.status, reason: p.progress.reason, detail: detailOf(p.progress),
      since: sinceLabel(p.progress.daysSince), daysSince: p.progress.daysSince, week: p.progress.week,
      pay: m?.label ? { label: m.label, active: m.active, attention: m.attention } : m && !m.active ? { label: 'Inactive', active: false, attention: false } : null,
    };
  });

  // What the note dialog needs: everyone it could go to, and who's in each group.
  // Not the players switched off: they can't open the app to read one.
  const reach = all.filter((p) => isActive(p.user_id));
  const notePlayers = reach.map((p) => ({ id: p.user_id, name: p.name, nudge: nudgeDraft(p.first, p.progress) }));
  const noteGroups = groups.map((g) => ({
    id: g.id, name: g.name,
    members: content.memberships.filter((m) => m.group_id === g.id && reach.some((p) => p.user_id === m.user_id)).map((m) => m.user_id),
  }));

  // A failed load isn't an empty academy: no "No players yet", no invite card.
  const headline = error ? 'Couldn’t load your players'
    : !players.length ? (inGroup ? `No one in ${inGroup.name} yet` : 'No players yet')
    : needs ? `${needs} ${needs === 1 ? 'player needs' : 'players need'} a nudge`
    : behind.length ? `${behind.length} ${behind.length === 1 ? 'player is' : 'players are'} ${oneBehind ? 'a session' : 'a little'} behind`
    : 'Everyone’s on track';

  return (
    <NoteProvider players={notePlayers} groups={noteGroups}>
    <div className="animate-pop">
      <ViewTabs tabs={PLAYER_VIEWS} on="/coach" query={inGroup ? `group=${inGroup.id}` : undefined} />
      {/* Invite players is always here and always the filled button: inviting
          is how an academy grows. On a phone the three don't fit on a line,
          so it takes a row of its own and the other two share the next. */}
      <PageHead title={headline} actionRow
                action={<>
                  <NudgeAll className="flex-1 lg:flex-none" people={behind.map((p) => ({ id: p.user_id, name: p.name, body: nudgeDraft(p.first, p.progress) }))} />
                  {!!players.length && (
                    <NoteButton group={inGroup?.id} className="btn-ghost btn-sm pressable flex-1 lg:flex-none">Send a note</NoteButton>
                  )}
                  {!!all.length && <Link href="/coach/team#invite" className="btn-primary btn-sm pressable order-first w-full lg:order-none lg:w-auto">Invite players</Link>}
                </>}>
        {!!players.length && <><b className="font-semibold text-on-surface">{trained} of {training.length}</b> trained this week.</>}
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
      {cardDue && (
        <section role="status" className="card mt-5 flex items-center gap-4 p-5 lg:max-w-xl">
          <div className="min-w-0 flex-1">
            <div className="h-card">{cardDue === 'failed' ? 'Your last payment didn’t go through' : `Add a card for ${academy.name}`}</div>
            <p className="mt-0.5 text-body text-on-surface-variant">
              {cardDue === 'failed' ? 'Update your card to keep things running.'
                : `${training.length} active ${training.length === 1 ? 'player' : 'players'} · ${dollars(monthlyCents(training.length))} a month.`}
            </p>
          </div>
          <Link href="/coach/billing" className="btn-primary btn-sm pressable shrink-0">Billing</Link>
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

      {/* The invite link leads only while there's nobody to list; after that it lives under Settings. */}
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
