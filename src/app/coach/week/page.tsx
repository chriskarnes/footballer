import Link from 'next/link';
import { staffOnly } from '@/components/coach/Gate';
import { PageHead } from '@/components/coach/PageHead';
import { PLAYER_VIEWS, ViewTabs } from '@/components/coach/ViewTabs';
import { StatusDot } from '@/components/coach/WeekDots';
import { loadContent } from '@/lib/academy-data';
import { teamDays } from '@/lib/academy-week';
import { loadPlayers } from '@/lib/coach-data';
import { LoadFailed } from '@/components/coach/LoadFailed';
import { byAttention, localDate, weekdayOf } from '@/lib/progress';

export const metadata = { title: 'This week', robots: { index: false } };

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Everyone's week on one screen: players down the side, days across. Nothing
 * here is set by hand. Each player's sessions sit where the app put them,
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

  return (
    <div className="animate-pop">
      <ViewTabs tabs={PLAYER_VIEWS} on="/coach/week" />
      <PageHead title="This week">Sessions sit on the days that fit each player&rsquo;s soccer.</PageHead>

      {!!groups.length && (
        <nav className="scroll-x -mx-5 mt-6 flex gap-2 px-5 lg:mx-0 lg:flex-wrap lg:px-0" aria-label="Filter by group">
          <Link href="/coach/week" className={`chip shrink-0 ${!inGroup ? 'chip-on' : ''}`}>Everyone</Link>
          {groups.map((g) => (
            <Link key={g.id} href={`/coach/week?group=${g.id}`} className={`chip shrink-0 ${inGroup?.id === g.id ? 'chip-on' : ''}`}>{g.name}</Link>
          ))}
        </nav>
      )}

      {!!unset && (
        <p className="mt-4 text-body-sm text-on-surface-variant">
          <b className="font-semibold text-on-surface">{unset} {unset === 1 ? 'player hasn’t' : 'players haven’t'}</b> said their soccer days yet,
          so their sessions are spread through the week. They&rsquo;re asked on their home screen.
        </p>
      )}

      {/* Seven days fit from a 1024px screen up (the name column narrows on
          a laptop); narrower, it scrolls, with the bar showing so it's clear
          there's more. */}
      <div className="scroll-x scroll-shown -mx-5 mt-6 px-5 lg:mx-0 lg:px-0">
        <table className="card w-full min-w-[680px] table-fixed border-separate border-spacing-0 overflow-hidden text-left text-body-sm">
          <colgroup><col className="w-32 xl:w-44" />{DAYS.map((d) => <col key={d} />)}</colgroup>
          <thead>
            <tr className="eyebrow">
              <th scope="col" className="border-b border-outline-variant px-4 py-3">Player</th>
              {DAYS.map((d, i) => (
                <th key={d} scope="col" className={`border-b border-outline-variant px-2 py-3 ${i === today ? 'text-on-surface' : ''}`}>
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
                  <th scope="row" className="border-b border-outline-variant px-4 py-3 font-normal">
                    <Link href={`/coach/players/${p.user_id}`} className="flex items-center gap-2 font-bold text-on-surface hover:underline">
                      <StatusDot status={p.progress.status} /><span className="truncate">{p.name}</span>
                    </Link>
                    <span className="mt-0.5 block text-caption text-on-surface-variant">
                      {p.week.filter((w) => w.done).length} of {p.week.length} done
                    </span>
                  </th>
                  {DAYS.map((_, d) => {
                    const items = p.week.filter((w) => w.weekday === d);
                    const tag = s.games.includes(d) ? 'Game' : s.trainer.includes(d) ? 'Trainer' : s.practice.includes(d) ? 'Practice' : meets.has(d) ? 'Trainer' : null;
                    return (
                      <td key={d} className={`border-b border-l border-outline-variant px-1.5 py-2 ${tag ? 'bg-surface-container' : ''} ${d === today ? 'bg-surface-container-low' : ''}`}>
                        {tag && <span className="eyebrow block px-1">{tag}</span>}
                        {items.map((it) => {
                          const missed = !it.done && d < today;
                          return (
                            <span key={it.key} title={`${it.title} · ${it.minutes} min${it.moved ? ' · moved by player' : ''}`}
                                  className={`mt-1 block truncate rounded-small px-1.5 py-1 text-caption font-semibold
                                    ${it.done ? 'bg-on-surface text-surface' : missed ? 'border border-dashed border-on-surface-variant text-on-surface-variant' : 'border border-outline text-on-surface'}`}>
                              {it.done && '✓ '}{it.title}{it.moved && ' ↷'}
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

      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-caption text-on-surface-variant">
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-extra-small bg-on-surface align-middle" />Done</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-extra-small border border-outline align-middle" />To do</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-extra-small border border-dashed border-on-surface-variant align-middle" />Missed</span>
        <span>↷ Moved by the player</span>
        <span>Shaded: practice, game or trainer day</span>
      </p>
    </div>
  );
}
