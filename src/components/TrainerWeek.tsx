import Link from 'next/link';
import type { MyWeek } from '@/lib/player-week';
import { MoveDay } from './MoveDay';
import { SoccerDaysPanel } from './SoccerDays';
import { AddSession } from './AddSession';
import { BandTag, BandTitle, BrandBand } from './BrandBand';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Tick = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor"
       strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

/**
 * A player's week from their trainer, set for a ten-year-old: the next
 * session and one big Start, the week as seven marks, then the week as a
 * list. Nothing else. Where a session comes from, which group it belongs to
 * and how the week was fitted are the trainer's business, not the player's;
 * soccer days live on Me once they've been answered.
 */
export function TrainerWeek({ week }: { week: MyWeek }) {
  const { items, today, schedule } = week;
  const set = items.filter((i) => !i.extra);
  const done = set.filter((i) => i.done).length;
  const next = items.find((i) => !i.done && i.weekday >= today) ?? items.find((i) => !i.done) ?? null;
  const doneToday = items.some((i) => i.done && (i.doneOn ?? i.weekday) === today);

  // One or two words on which day the headline is about.
  const when = !next ? 'This week'
    : next.weekday === today ? 'Today'
    : next.weekday < today ? `Missed ${DAYS[next.weekday]}`
    : doneToday ? `Today’s done · Next ${DAYS[next.weekday]}`
    : `Next · ${DAYS[next.weekday]}`;

  return (
    <section>
      <BrandBand>
        <BandTag>{when}</BandTag>
        <BandTitle>{next ? next.title : items.length ? 'All done!' : 'Nothing yet'}</BandTitle>
        <p className="mt-3 text-[16px] font-semibold text-on-surface-brand-variant">
          {next ? `${next.minutes} min · ${next.drills} ${next.drills === 1 ? 'drill' : 'drills'}`
            : items.length ? 'You finished your whole week.' : 'Your trainer hasn’t set this week.'}
        </p>
        {/* What the trainer said about this one, in their words. */}
        {next?.note && (
          <p className="mt-3 text-[15px] font-medium leading-snug text-on-surface-brand">&ldquo;{next.note}&rdquo;</p>
        )}
        {next && (
          <Link href={`/train/${next.kind}/${next.ref}`}
                className="btn-primary btn-big pressable mt-6 w-full bg-on-surface-brand text-surface-brand">
            Start
          </Link>
        )}
        <WeekStrip items={items} today={today} nextDay={next?.weekday ?? null} />
      </BrandBand>

      {items.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex items-baseline justify-between gap-3">
            <h2 className="h-sec">My week</h2>
            {set.length > 0 && <p className="text-[15px] font-bold text-on-surface-variant">{done} of {set.length} done</p>}
          </div>
          <ul className="space-y-2.5">
            {items.map((it) => (
              <li key={it.key} className="card flex min-h-[68px] items-center gap-2 pr-3">
                <Link href={`/train/${it.kind}/${it.ref}`} className="flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-4">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${it.done ? 'border-on-surface bg-on-surface' : 'border-outline'}`}>
                    {it.done && <Tick className="h-4 w-4 text-surface" />}
                  </span>
                  <span className={`min-w-0 flex-1 text-[16px] font-bold leading-snug ${it.done ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                    {it.title}
                    {!it.done && it.weekday < today && <span className="block text-[13px] font-semibold text-on-surface-variant">Missed</span>}
                  </span>
                </Link>
                {it.done
                  ? <span className="shrink-0 pr-2 text-[13px] font-bold text-on-surface-variant">{DAYS[it.doneOn ?? it.weekday].slice(0, 3)}</span>
                  : <MoveDay itemKey={it.key} weekday={it.weekday} placed={it.placed ?? it.weekday} title={it.title} />}
              </li>
            ))}
          </ul>
        </>
      )}

      {week.more && <AddSession why={week.more.why} />}

      {/* Asked once, here, because the answer moves the sessions above. After
          that it's a setting, and settings are on Me. */}
      {!schedule && items.some((i) => i.kind !== 'addon') && (
        <div className="mt-4"><SoccerDaysPanel club={[]} game={null} set={false} /></div>
      )}
    </section>
  );
}

/**
 * Monday to Sunday in the band. Today is the lit column; a tick is a session
 * done, on the day it was done; the solid disc is the session in the
 * headline; a ring is one still to come; a rest day is a speck.
 */
function WeekStrip({ items, today, nextDay }: { items: MyWeek['items']; today: number; nextDay: number | null }) {
  const ink = 'var(--app-on-surface-brand)';
  return (
    <ol className="mt-7 flex max-w-sm justify-between" aria-label="This week">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
        const todo = items.filter((x) => !x.done && x.weekday === i);
        const doneHere = items.some((x) => x.done && (x.doneOn ?? x.weekday) === i);
        const isToday = i === today;
        const label = `${DAYS[i]}${isToday ? ' (today)' : ''}: ${todo.length ? `${todo.length} to do` : doneHere ? 'done' : 'rest'}`;
        return (
          <li key={i} aria-label={label} aria-current={isToday ? 'date' : undefined}
              className="flex w-10 flex-col items-center gap-1.5 rounded-full pb-1.5 pt-2"
              style={isToday ? { background: `color-mix(in srgb, ${ink} 18%, transparent)` } : undefined}>
            <span className="text-[12.5px] font-extrabold" style={{ color: ink, opacity: isToday ? 1 : 0.7 }}>{d}</span>
            <span className="flex h-7 w-7 items-center justify-center">
              {!todo.length && doneHere ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }}>
                  <Tick className="h-3.5 w-3.5" />
                </span>
              ) : todo.length ? (
                <span className="h-7 w-7 rounded-full"
                      style={i === nextDay ? { background: ink } : { boxShadow: `inset 0 0 0 2.5px ${ink}` }} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: ink, opacity: 0.35 }} />
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
