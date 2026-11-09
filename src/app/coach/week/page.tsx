import Link from 'next/link';
import { staffOnly } from '@/components/coach/Gate';
import { PageHead } from '@/components/coach/PageHead';
import { StatusDot } from '@/components/coach/WeekDots';
import { loadContent } from '@/lib/academy-data';
import { loadPlayers } from '@/lib/coach-data';
import { byAttention, localDate, weekdayOf } from '@/lib/progress';

export const metadata = { title: 'Week', robots: { index: false } };

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
  const { players: all } = await loadPlayers(db, academy, { content });
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
      <PageHead title="This week" eyebrow={inGroup ? inGroup.name : 'Everyone'}>
        Each player&rsquo;s sessions, on the days that fit their soccer. They set their club and game days; you don&rsquo;t keep this up to date.
      </PageHead>

      {!!groups.length && (
        <nav className="scroll-x -mx-5 mt-6 flex gap-2 px-5 lg:mx-0 lg:flex-wrap lg:px-0" aria-label="Filter by group">
          <Link href="/coach/week" className={`chip shrink-0 ${!inGroup ? 'chip-on' : ''}`}>Everyone</Link>
          {groups.map((g) => (
            <Link key={g.id} href={`/coach/week?group=${g.id}`} className={`chip shrink-0 ${inGroup?.id === g.id ? 'chip-on' : ''}`}>{g.name}</Link>
          ))}
        </nav>
      )}

      {!!unset && (
        <p className="mt-4 text-[13px] text-on-surface-variant">
          <b className="font-semibold text-on-surface">{unset} {unset === 1 ? 'player hasn’t' : 'players haven’t'}</b> said their soccer days yet,
          so their sessions are spread through the week. They&rsquo;re asked on their home screen.
        </p>
      )}

      <div className="scroll-x -mx-5 mt-6 px-5 lg:mx-0 lg:px-0">
        <table className="card w-full min-w-[760px] table-fixed border-separate border-spacing-0 overflow-hidden text-left text-[13px]">
          <colgroup><col className="w-44" />{DAYS.map((d) => <col key={d} />)}</colgroup>
          <thead>
            <tr className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">
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
              const s = content.schedules.find((x) => x.user_id === p.user_id);
              const meets = new Set(content.groups.filter((g) => !g.archived && g.meets_weekday !== null
                && content.memberships.some((m) => m.group_id === g.id && m.user_id === p.user_id)).map((g) => g.meets_weekday as number));
              return (
                <tr key={p.user_id} className="align-top">
                  <th scope="row" className="border-b border-outline-variant px-4 py-3 font-normal">
                    <Link href={`/coach/players/${p.user_id}`} className="flex items-center gap-2 font-bold text-on-surface hover:underline">
                      <StatusDot status={p.progress.status} /><span className="truncate">{p.name}</span>
                    </Link>
                    <span className="mt-0.5 block text-[12px] text-on-surface-variant">
                      {p.week.filter((w) => w.done).length} of {p.week.length} done
                    </span>
                  </th>
                  {DAYS.map((_, d) => {
                    const items = p.week.filter((w) => w.weekday === d);
                    const tag = s?.game_day === d ? 'Game' : s?.club_days.includes(d) ? 'Club' : meets.has(d) ? 'Group' : null;
                    return (
                      <td key={d} className={`border-b border-l border-outline-variant px-1.5 py-2 ${tag ? 'bg-surface-container' : ''} ${d === today ? 'bg-surface-container-low' : ''}`}>
                        {tag && <span className="block px-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{tag}</span>}
                        {items.map((it) => {
                          const missed = !it.done && d < today;
                          return (
                            <span key={it.key} title={`${it.title} · ${it.minutes} min${it.moved ? ' · moved by player' : ''}`}
                                  className={`mt-1 block truncate rounded-md px-1.5 py-1 text-[12px] font-semibold
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

      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-on-surface-variant">
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-on-surface align-middle" />Done</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border border-outline align-middle" />To do</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-on-surface-variant align-middle" />Missed</span>
        <span>↷ Moved by the player</span>
        <span>Shaded: club, game or group day</span>
      </p>
    </div>
  );
}
