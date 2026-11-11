import Link from 'next/link';
import type { MyWeek } from '@/lib/player-week';
import { MoveDay } from './MoveDay';
import { SoccerDaysPanel } from './SoccerDays';
import { AddSession } from './AddSession';
import { BandTag, BandTitle, BrandBand } from './BrandBand';

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
  const set = items.filter((i) => !i.extra);
  const done = set.filter((i) => i.done).length;
  const next = items.find((i) => !i.done && i.weekday >= today) ?? items.find((i) => !i.done) ?? null;

  // The tag says which day the headline is about, and why it's the headline:
  // a bare "Friday" on a Wednesday read as if the app had the date wrong.
  // Finished today, whichever day it was set for; one from later in the week counts as early.
  const doneToday = items.filter((i) => i.done && (i.doneOn ?? i.weekday) === today);
  const early = doneToday.find((i) => i.weekday > today);
  const when = !next ? 'This week'
    : next.weekday === today ? 'Today'
    : next.weekday < today ? `Missed · ${DAYS[next.weekday]}`
    : `Up next · ${DAYS[next.weekday]}`;
  // What today itself is, when the headline is about another day.
  const todayIs = !next || next.weekday === today ? null
    : early ? `${DAYS[early.weekday]}’s session done early.`
    : doneToday.length ? 'Today’s session is done.' : 'Nothing set for today.';

  return (
    <section>
      {/* The week leads, in the academy's colours, the way the site opens. */}
      <BrandBand overlap={!!next}>
        <BandTag>{when}</BandTag>
        <BandTitle>{next ? next.title : items.length ? 'Week done' : 'This week'}</BandTitle>
        <p className="mt-3 text-[14px] text-on-surface-brand-variant">
          {next ? <>
            {todayIs && <><b className="font-semibold text-on-surface-brand">{todayIs}</b>{' '}</>}
            {next.minutes} min · {next.drills} {next.drills === 1 ? 'drill' : 'drills'}{next.practice && ' · Practice day too'}
            {next.light ? ' · Lighter week' : next.ups ? ` · ${next.ups} ${next.ups === 1 ? 'drill levels' : 'drills level'} up` : ''}
          </> : <>
            {early && <><b className="font-semibold text-on-surface-brand">{DAYS[early.weekday]}’s session done early.</b>{' '}</>}
            Everything your trainer set this week is finished.
          </>}
        </p>
        <WeekStrip items={items} today={today} nextDay={next?.weekday ?? null} done={done} total={set.length} />
      </BrandBand>

      {next && (
        <div className="card relative -mt-12 p-5">
          <Source item={next} />
          {next.note && <p className="mt-3 border-l-2 border-on-surface pl-3 text-[14px] leading-snug text-on-surface">{next.note}</p>}
          <Link href={`/train/${next.kind}/${next.ref}`} className="btn-primary pressable mt-4 w-full">
            {next.weekday === today ? 'Start' : next.weekday < today ? 'Do it today' : 'Start early'}
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex items-baseline justify-between">
            <p className="eyebrow">This week</p>
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
                      {it.done && it.doneOn !== undefined && it.doneOn < it.weekday && <b className="font-semibold text-on-surface">Done early · </b>}
                      {it.minutes} min · {it.practice ? 'Practice day' : it.extra ? 'Added by you' : it.kind === 'custom' ? 'Built for you' : it.kind === 'addon' ? 'Just for you' : it.groups[0] ?? 'Your program'}
                    </span>
                  </span>
                </Link>
                {it.done
                  ? <span className="shrink-0 pr-2 text-[12.5px] font-bold text-on-surface-variant">{DAYS[it.doneOn ?? it.weekday].slice(0, 3)}</span>
                  : <MoveDay itemKey={it.key} weekday={it.weekday} placed={it.placed ?? it.weekday} title={it.title} />}
              </li>
            ))}
          </ul>
        </>
      )}

      {week.more && <AddSession left={week.more.left} why={week.more.why} />}

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
/**
 * Monday to Sunday in the band, with the count beside it. Each mark means one
 * thing: today is the lit column, accent with a tick is done, the solid disc
 * is the session in the headline, a ring is a session still to come, and a
 * rest day is only a speck, so it never reads as an empty checkbox.
 *
 * A tick sits on the day the session was actually done. One finished on
 * another day leaves an outlined tick on the day it was set for: nothing
 * left to do there, and the week still shows where it was meant to go.
 */
function WeekStrip({ items, today, nextDay, done, total }: {
  items: MyWeek['items']; today: number; nextDay: number | null; done: number; total: number;
}) {
  const ink = 'var(--app-on-surface-brand)';
  return (
    <div className="mt-6 max-w-sm">
      <p className="flex items-baseline justify-between px-1 text-[12.5px] font-semibold text-on-surface-brand-variant">
        <span>This week</span>
        {total > 0 && <span><b className="font-extrabold text-on-surface-brand">{done} of {total}</b> done</span>}
      </p>
      <ol className="mt-2 flex justify-between" aria-label="This week">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
          // Still to do, on the day it's set for; done, on the day it was done.
          const todo = items.filter((x) => !x.done && x.weekday === i);
          const doneHere = items.some((x) => x.done && (x.doneOn ?? x.weekday) === i);
          const cleared = items.filter((x) => x.done && x.weekday === i && (x.doneOn ?? i) !== i);
          const isToday = i === today;
          const isNext = i === nextDay;
          const label = `${DAYS[i]}${isToday ? ' (today)' : ''}: ${todo.length ? `${todo.length} to do`
            : doneHere ? 'done'
            : cleared.length ? `done on ${DAYS[cleared[0].doneOn!]}` : 'rest'}`;
          return (
            <li key={i} aria-label={label} aria-current={isToday ? 'date' : undefined}
                className="flex w-10 flex-col items-center gap-1.5 rounded-full pb-1.5 pt-2"
                style={isToday ? { background: `color-mix(in srgb, ${ink} 18%, transparent)` } : undefined}>
              <span className="text-[11.5px] font-extrabold"
                    style={{ color: ink, opacity: isToday ? 1 : 0.7 }}>{d}</span>
              <span className="flex h-7 w-7 items-center justify-center">
                {!todo.length && doneHere ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                ) : todo.length ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-[12.5px] font-extrabold"
                        style={isNext ? { background: ink, color: 'var(--app-brand-primary)' }
                          : { boxShadow: `inset 0 0 0 2.5px ${ink}`, color: ink }}>
                    {todo.length > 1 ? todo.length : ''}
                  </span>
                ) : cleared.length ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ boxShadow: 'inset 0 0 0 2px var(--app-brand-accent)', color: 'var(--app-brand-accent)', opacity: 0.75 }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ink, opacity: 0.35 }} />
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Source({ item }: { item: MyWeek['items'][number] }) {
  const label = item.extra ? 'Added by you, from your trainer’s drills'
    : item.kind === 'addon' ? 'Just for you, from your trainer'
    : item.kind === 'custom' ? 'Built for you by your trainer'
    : [item.groups.join(' & ') || 'Your program', item.from].join(' · ');
  return <p className="text-[12.5px] font-semibold text-on-surface-variant">{label}</p>;
}
