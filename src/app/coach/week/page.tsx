import Link from 'next/link';
import { STATUS_TONE, StatusTag } from '@/components/coach/StatusTag';
import { GroupGone } from '@/components/coach/GroupGone';
import { staffOnly } from '@/components/coach/Gate';
import { PageHead } from '@/components/coach/PageHead';
import { PLAYER_VIEWS, ViewTabs } from '@/components/coach/ViewTabs';
import { StatusDot } from '@/components/coach/WeekDots';
import { loadContent } from '@/lib/academy-data';
import { setItems, teamDays } from '@/lib/academy-week';
import { loadPlayers } from '@/lib/coach-data';
import { LoadFailed } from '@/components/coach/LoadFailed';
import { Empty } from '@/components/coach/Empty';
import { byAttention, detailOf, localDate, weekdayOf } from '@/lib/progress';

export const metadata = { title: 'This week', robots: { index: false } };

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Everyone's week on one screen: players down the side, days across. On a
 * phone seven columns don't fit, so each player is a card with their
 * sessions listed under their name, in words. Nothing here is set by hand. Each player's sessions sit where the app put them,
 * around the club and game days they told it, or where they moved them.
 * The trainer reads it; they don't keep it up to date.
 */
export default async function WeekPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const gate = await staffOnly('/coach/week');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const { group } = await searchParams;
  const content = await loadContent(db, academy.id);
  const { players: all, error } = await loadPlayers(db, academy, { content });
  if (error) return <LoadFailed title="This week" path="/coach/week" />;
  all.sort(byAttention);
  const groups = content.groups.filter((g) => !g.archived);
  const inGroup = groups.find((g) => g.id === group);
  const players = inGroup
    ? all.filter((p) => content.memberships.some((m) => m.group_id === inGroup.id && m.user_id === p.user_id))
    : all;
  const today = weekdayOf(localDate(new Date(), academy.timeZone));
  const unset = players.filter((p) => !content.schedules.some((s) => s.user_id === p.user_id)).length;
  // Only what was set can be missed: a "just for you" drill or an extra isn't due.
  const missed = (it: (typeof players)[number]['week'][number]) => !it.done && it.weekday < today && setItems([it]).length > 0;
  const count = (p: (typeof players)[number]) =>
    p.progress.hasPlan ? `${p.progress.done} of ${p.progress.planned} done` : detailOf(p.progress) ?? 'Nothing set';

  return (
    <div className="animate-pop">
      <ViewTabs tabs={PLAYER_VIEWS} on="/coach/week" query={inGroup ? `group=${inGroup.id}` : undefined} />
      <PageHead title="This week">Sessions sit on the days that fit each player&rsquo;s soccer.</PageHead>

      {!!groups.length && (
        <nav className="scroll-x -mx-5 mt-6 flex gap-2 px-5 lg:mx-0 lg:flex-wrap lg:px-0" aria-label="Filter by group">
          <Link href="/coach/week" className={`chip shrink-0 ${!inGroup ? 'chip-on' : ''}`}>Everyone</Link>
          {groups.map((g) => (
            <Link key={g.id} href={`/coach/week?group=${g.id}`} className={`chip shrink-0 ${inGroup?.id === g.id ? 'chip-on' : ''}`}>{g.name}</Link>
          ))}
        </nav>
      )}
      <GroupGone group={group} groups={content.groups} />

      {!!unset && (
        <p className="mt-4 text-body-sm text-on-surface-variant">
          <b className="font-semibold text-on-surface">{unset} {unset === 1 ? 'player hasn’t' : 'players haven’t'}</b> said their soccer days yet,
          so their sessions are spread through the week. They&rsquo;re asked on their home screen.
        </p>
      )}

      {!players.length ? (
        <div className="mt-6">
          {inGroup
            ? <Empty title={`No one in ${inGroup.name} yet`} href={`/coach/groups/${inGroup.id}`} cta="Add players">
                Add players to the group and their week shows here.
              </Empty>
            : <Empty title="No players yet" href="/coach/team" cta="Invite players">
                Once players join, their week shows here, day by day.
              </Empty>}
        </div>
      ) : <>
      {/* Phone: a card a player, their sessions in the order of the week.
          Practice, game and with-you days aren't listed: there's nothing on
          them to do, and the table's shading has no place here. */}
      <ul className="mt-6 space-y-2.5 lg:hidden">
        {players.map((p) => {
          const items = [...p.week].sort((a, b) => a.weekday - b.weekday);
          return (
            <li key={p.user_id} className="card p-4">
              <Link href={`/coach/players/${p.user_id}`} className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-body-lg font-bold text-on-surface">
                  <StatusDot status={p.progress.status} /><span className="truncate">{p.name}</span>
                </span>
                <span className="shrink-0 text-body-sm text-on-surface-variant">{count(p)}</span>
              </Link>
              {items.length ? (
                <ul className="mt-2 divide-y divide-outline-variant">
                  {items.map((it) => (
                    <li key={it.key} className="flex items-baseline gap-3 py-2 text-body">
                      <span className={`w-9 shrink-0 text-body-sm ${it.weekday === today ? 'font-bold text-on-surface' : 'font-semibold text-on-surface-variant'}`}>{DAYS[it.weekday]}</span>
                      <span className="min-w-0 flex-1 text-on-surface">{it.title}</span>
                      <span className="shrink-0 text-body-sm">
                        {it.done ? <span className="font-semibold text-on-surface"><span aria-hidden="true">✓ </span>Done</span>
                          : missed(it) ? <StatusTag status="bad">Missed</StatusTag>
                          : <span className="text-on-surface-variant">To do</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-body-sm text-on-surface-variant">Nothing to do this week.</p>}
            </li>
          );
        })}
      </ul>

      {/* Laptop: seven days fit from a 1024px screen up (the name column
          narrows there). */}
      <div className="mt-6 hidden lg:block">
        <table className="card w-full min-w-[680px] table-fixed border-separate border-spacing-0 overflow-hidden text-left text-body-sm">
          <colgroup><col className="w-32 xl:w-44" />{DAYS.map((d) => <col key={d} />)}</colgroup>
          <thead>
            <tr className="eyebrow">
              <th scope="col" className="sticky left-0 z-10 border-b border-outline-variant bg-surface-container-lowest px-4 py-3">Player</th>
              {DAYS.map((d, i) => (
                <th key={d} scope="col" className={`border-b border-outline-variant px-2 py-3 ${i === today ? 'bg-surface-container-low text-on-surface' : ''}`}>
                  {d}{i === today && <span className="ml-1 normal-case tracking-normal">· today</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const s = teamDays(content.schedules.find((x) => x.user_id === p.user_id));
              const meets = new Set(content.groups.filter((g) => !g.archived && g.meets_weekday !== null
                && content.memberships.some((m) => m.group_id === g.id && m.user_id === p.user_id)).map((g) => g.meets_weekday as number));
              return (
                <tr key={p.user_id} className="align-top">
                  <th scope="row" className="sticky left-0 z-10 border-b border-outline-variant bg-surface-container-lowest px-4 py-3 font-normal">
                    <Link href={`/coach/players/${p.user_id}`} className="flex items-center gap-2 font-bold text-on-surface hover:underline">
                      <StatusDot status={p.progress.status} /><span className="truncate">{p.name}</span>
                    </Link>
                    <span className="mt-0.5 block text-caption text-on-surface-variant">{count(p)}</span>
                  </th>
                  {DAYS.map((_, d) => {
                    const items = p.week.filter((w) => w.weekday === d);
                    // A day with their trainer is "With you": it's the trainer reading this.
                    const tag = s.games.includes(d) ? 'Game' : s.trainer.includes(d) ? 'With you' : s.practice.includes(d) ? 'Practice' : meets.has(d) ? 'With you' : null;
                    return (
                      <td key={d} className={`border-b border-l border-outline-variant px-1.5 py-2 ${/* One background per cell: two collided, and today hid the busy shading. */
                        tag ? (d === today ? 'bg-surface-container-high' : 'bg-surface-container') : d === today ? 'bg-surface-container-low' : ''}`}>
                        {tag && <span className="eyebrow block px-1">{tag}</span>}
                        {items.map((it) => {
                          const late = missed(it);
                          return (
                            <span key={it.key} title={`${it.title} · ${it.minutes} min${it.moved ? ' · moved by player' : ''}`}
                                  className={`mt-1 block truncate rounded-small px-1.5 py-1 text-caption font-semibold
                                    ${it.done ? STATUS_TONE.good : late ? `${STATUS_TONE.bad} border border-dashed border-current` : 'border border-outline text-on-surface'}`}>
                              {it.done && <span aria-hidden="true">✓ </span>}
                              {/* The mark and the border carry these by sight; say them too. */}
                              <span className="sr-only">{it.done ? 'Done: ' : late ? 'Missed: ' : ''}</span>
                              {it.title}{it.moved && <><span aria-hidden="true"> ↷</span><span className="sr-only"> (moved by player)</span></>}
                            </span>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* The legend is the table's: the cards say done, missed and to do in words. */}
      <p className="mt-4 hidden flex-wrap gap-x-5 gap-y-1 text-caption text-on-surface-variant lg:flex">
        <span><span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-extra-small align-middle ${STATUS_TONE.good}`} />Done</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-extra-small border border-outline align-middle" />To do</span>
        <span><span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-extra-small border border-dashed border-current align-middle ${STATUS_TONE.bad}`} />Missed</span>
        <span>↷ Moved by the player</span>
        <span>Shaded: practice, game or a day with you</span>
      </p>
      </>}
    </div>
  );
}
