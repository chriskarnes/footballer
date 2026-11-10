import Link from 'next/link';
import type { MyWeek } from '@/lib/player-week';
import { MoveDay } from './MoveDay';
import { SoccerDaysPanel } from './SoccerDays';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * A player's week from their trainer, as one list. Each session says where
 * it's from (a group's program, or "Just for you"), so a player in two groups
 * and a 1-to-1 never wonders which plan they're on: there's one.
 *
 * The next thing to do leads, with a Start button; the rest follow in day
 * order, ticked when done. Each sits on a day picked around the player's own
 * soccer (they say which days, once), and can be moved for this week.
 */
export function TrainerWeek({ week }: { week: MyWeek }) {
  const { items, groups, today, schedule } = week;
  const done = items.filter((i) => i.done).length;
  const next = items.find((i) => !i.done && i.weekday >= today) ?? items.find((i) => !i.done) ?? null;

  return (
    <section>
      {next ? (
        <div className="card p-5">
          <p className="eyebrow">{next.weekday === today ? 'Today' : next.weekday < today ? `Missed ${DAYS[next.weekday]} · do it today?` : DAYS[next.weekday]}</p>
          <h2 className="mt-2 font-brand text-[24px] font-extrabold leading-tight tracking-tighter text-on-surface">{next.title}</h2>
          <p className="mt-1 text-[13.5px] text-on-surface-variant">
            {next.minutes} min · {next.drills} {next.drills === 1 ? 'drill' : 'drills'}{next.practice && ' · Practice day too'}
            {next.light ? ' · Lighter week' : next.ups ? ` · ${next.ups} ${next.ups === 1 ? 'drill levels' : 'drills level'} up` : ''}
          </p>
          <Source item={next} />
          {next.note && <p className="mt-3 border-l-2 border-on-surface pl-3 text-[14px] leading-snug text-on-surface">{next.note}</p>}
          <Link href={`/train/${next.kind}/${next.ref}`} className="btn-primary pressable mt-5 w-full">Start</Link>
        </div>
      ) : items.length ? (
        <div className="card p-5">
          <p className="eyebrow">This week</p>
          <h2 className="mt-2 font-brand text-[24px] font-extrabold leading-tight tracking-tighter text-on-surface">All done</h2>
          <p className="mt-1 text-[14px] text-on-surface-variant">Everything your trainer set this week is finished.</p>
        </div>
      ) : null}

      {items.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex items-baseline justify-between">
            <p className="eyebrow">This week</p>
            <span className="text-[13px] font-semibold text-on-surface-variant">{done} of {items.length} done</span>
          </div>
          <ul className="card divide-y divide-outline-variant">
            {items.map((it) => (
              <li key={it.key} className="flex items-center gap-2 pr-3">
                <Link href={`/train/${it.kind}/${it.ref}`} className="flex min-w-0 flex-1 items-center gap-3.5 py-3.5 pl-4">
                  <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${it.done ? 'border-on-surface bg-on-surface' : 'border-outline'}`}>
                    {it.done && <svg viewBox="0 0 24 24" className="h-3 w-3 text-surface" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14.5px] font-semibold ${it.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{it.title}</span>
                    <span className="block truncate text-[12.5px] text-on-surface-variant">
                      {!it.done && it.weekday < today && <b className="font-semibold text-on-surface">Missed · </b>}
                      {it.minutes} min · {it.practice ? 'Practice day' : it.kind === 'addon' ? 'Just for you' : it.groups[0] ?? 'Just for you'}
                    </span>
                  </span>
                </Link>
                {it.done
                  ? <span className="shrink-0 pr-2 text-[12.5px] font-bold text-on-surface-variant">{DAYS[it.weekday].slice(0, 3)}</span>
                  : <MoveDay itemKey={it.key} weekday={it.weekday} placed={it.placed ?? it.weekday} title={it.title} />}
              </li>
            ))}
          </ul>
        </>
      )}

      {items.some((i) => i.kind !== 'addon') && (
        <div className="mt-4">
          <SoccerDaysPanel club={schedule?.club ?? []} game={schedule?.game ?? null} set={!!schedule} />
        </div>
      )}

      {!!groups.length && (
        <p className="mt-4 pl-1 text-[13px] leading-relaxed text-on-surface-variant">
          {groups.map((g, i) => (
            <span key={g.name}>{i > 0 && ' · '}<b className="font-semibold text-on-surface">{g.name}</b>{g.when && ` ${g.when}`}</span>
          ))}
        </p>
      )}
    </section>
  );
}

/** Where a session comes from, in words: "U12 Tuesday · Ball Mastery · Week 3 of 8". */
function Source({ item }: { item: MyWeek['items'][number] }) {
  const label = item.kind === 'addon' ? 'Just for you, from your trainer'
    : item.kind === 'custom' ? 'Built for you by your trainer'
    : [item.groups.join(' & ') || 'Just for you', item.from].join(' · ');
  return <p className="mt-3 text-[12.5px] font-semibold text-on-surface-variant">{label}</p>;
}
