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

  const when = next ? (next.weekday === today ? 'Today' : next.weekday < today ? `Missed ${DAYS[next.weekday]}` : DAYS[next.weekday]) : 'This week';

  return (
    <section>
      {/* The week leads, in the academy's colours, the way the site opens. */}
      <BrandBand overlap={!!next} right={set.length ? `${done} of ${set.length} done` : undefined}>
        <BandTag>{when}</BandTag>
        <BandTitle>{next ? next.title : items.length ? 'All done' : 'This week'}</BandTitle>
        <p className="mt-3 text-[14px] text-on-surface-brand-variant">
          {next ? <>
            {next.minutes} min · {next.drills} {next.drills === 1 ? 'drill' : 'drills'}{next.practice && ' · Practice day too'}
            {next.light ? ' · Lighter week' : next.ups ? ` · ${next.ups} ${next.ups === 1 ? 'drill levels' : 'drills level'} up` : ''}
          </> : 'Everything your trainer set this week is finished.'}
        </p>
        <WeekStrip items={items} today={today} />
      </BrandBand>

      {next && (
        <div className="card relative -mt-12 p-5">
          {next.weekday < today && <p className="mb-2 text-[13px] font-semibold text-on-surface">Do it today?</p>}
          <Source item={next} />
          {next.note && <p className="mt-3 border-l-2 border-on-surface pl-3 text-[14px] leading-snug text-on-surface">{next.note}</p>}
          <Link href={`/train/${next.kind}/${next.ref}`} className="btn-primary pressable mt-4 w-full">Start</Link>
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
                      {it.minutes} min · {it.practice ? 'Practice day' : it.extra ? 'Added by you' : it.kind === 'custom' ? 'Built for you' : it.kind === 'addon' ? 'Just for you' : it.groups[0] ?? 'Your program'}
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
 * Monday to Sunday in the band, as fixed circles: filled with a tick when
 * done, a ring when there's a session to do, a dot on a rest day. Today's
 * letter is in the accent colour, with a bar under its circle.
 */
function WeekStrip({ items, today }: { items: MyWeek['items']; today: number }) {
  return (
    <ol className="mt-6 flex max-w-sm justify-between" aria-label="This week">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
        const on = items.filter((x) => x.weekday === i);
        const doneHere = on.length > 0 && on.every((x) => x.done);
        const isToday = i === today;
        const label = `${DAYS[i]}${isToday ? ' (today)' : ''}: ${on.length ? (doneHere ? 'done' : `${on.length} to do`) : 'rest'}`;
        return (
          <li key={i} aria-label={label} className="flex w-9 flex-col items-center gap-1.5">
            <span className="text-[11.5px] font-extrabold" style={{ color: isToday ? 'var(--app-brand-accent)' : 'var(--app-on-surface-brand)' }}>{d}</span>
            {/* Every day is a solid shape, so the row reads on any brand colour:
                accent when done, a bright ring to do, a faint disc at rest. */}
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-extrabold"
                  style={doneHere ? { background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }
                    : on.length ? { boxShadow: 'inset 0 0 0 2.5px var(--app-on-surface-brand)', color: 'var(--app-on-surface-brand)' }
                    : { background: 'color-mix(in srgb, var(--app-on-surface-brand) 14%, transparent)' }}>
              {doneHere ? '✓' : on.length > 1 ? on.length : ''}
            </span>
            <span className="h-[3px] w-4 rounded-full" style={{ background: isToday ? 'var(--app-brand-accent)' : 'transparent' }} />
          </li>
        );
      })}
    </ol>
  );
}

function Source({ item }: { item: MyWeek['items'][number] }) {
  const label = item.extra ? 'Added by you, from your trainer’s drills'
    : item.kind === 'addon' ? 'Just for you, from your trainer'
    : item.kind === 'custom' ? 'Built for you by your trainer'
    : [item.groups.join(' & ') || 'Your program', item.from].join(' · ');
  return <p className="text-[12.5px] font-semibold text-on-surface-variant">{label}</p>;
}
