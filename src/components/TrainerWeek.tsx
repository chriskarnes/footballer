import Link from 'next/link';
import { getTrainer, type MyWeek } from '@/lib/player-week';
import { getUnread } from '@/lib/notes';
import { MoveDay } from './MoveDay';
import { SoccerDaysPanel } from './SoccerDays';
import { AddSession } from './AddSession';
import { Avatar } from './Avatar';
import { BandTag, BandTitle, BrandBand } from './BrandBand';
import { StartLink } from './StartLink';
import { TickMark } from './TickMark';
import { SpeedInvite } from './SpeedInvite';
import { speedAllowed } from '@/lib/speed-gate';

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
 *
 * The trainer is in the band: their newest unread note (or what they said
 * about this session) in their words, with their face, just above Start, and
 * when the player next sees them. The band is the compact one, so Start and
 * the first of the week fit on a small phone together.
 *
 * With the week done, the band says so and has the one way on: a bonus
 * session if their trainer allows extras and there's one left, else Speed if
 * their trainer offers it. No week strip then; seven ticks would only say
 * "done" again. On a game day it's rest instead.
 */
export async function TrainerWeek({ week }: { week: MyWeek }) {
  const { items, today, schedule } = week;
  const [trainer, unread, speed] = await Promise.all([getTrainer().catch(() => null), getUnread(), speedAllowed().catch(() => true)]);
  const set = items.filter((i) => !i.extra);
  const done = set.filter((i) => i.done).length;
  const next = items.find((i) => !i.done && i.weekday >= today) ?? items.find((i) => !i.done) ?? null;
  const doneToday = items.some((i) => i.done && (i.doneOn ?? i.weekday) === today);
  const weekDone = !next && items.length > 0;
  const gameDay = !!schedule?.games.includes(today);

  // One or two words on which day the headline is about.
  const when = !next ? 'This week'
    : next.weekday === today ? 'Today'
    : next.weekday < today ? `Missed ${DAYS[next.weekday]}`
    : doneToday ? `Today’s done · Next ${DAYS[next.weekday]}`
    : `Next · ${DAYS[next.weekday]}`;

  // The trainer's words for the band: a note they sent, newest unread first,
  // else what they said about this session. A note from another trainer
  // here gets that trainer's initial, not the owner's photo.
  const note = unread[0] ?? null;
  const said = note ? note.body : next?.note ?? null;
  const author = note ? note.author : trainer?.name ?? null;
  const theirs = !note || (!!trainer?.name && note.author.split(' ')[0] === trainer.name);
  // When they next see their trainer, from their group's meeting day.
  const meet = week.groups.filter((g) => g.when && g.day !== null)
    .sort((a, b) => ((a.day! - today + 7) % 7) - ((b.day! - today + 7) % 7))[0];
  const meetLabel = meet ? (meet.day === today ? meet.when!.replace(/^\w{3}/, 'today') : meet.when) : null;

  return (
    <section>
      <BrandBand compact>
        <BandTag>{when}</BandTag>
        {weekDone ? (
          <BandTitle>
            <span className="flex items-center gap-3">
              Week done!
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }}>
                <Tick className="h-4 w-4" />
              </span>
            </span>
          </BandTitle>
        ) : (
          <BandTitle>{next ? next.title : 'Nothing yet'}</BandTitle>
        )}
        {(!weekDone || gameDay) && (
          <p className="mt-2 text-[16px] font-semibold text-on-surface-brand-variant">
            {next ? `${next.minutes} min · ${next.drills} ${next.drills === 1 ? 'drill' : 'drills'}`
              : weekDone ? 'Game day. Rest up.' : 'Your trainer hasn’t set this week.'}
          </p>
        )}
        {/* The trainer, in their words, where the player is about to press. */}
        {said && (
          <TrainerSays href={note ? '/me/notes' : null} body={said}
                       name={author} photo={theirs ? trainer?.photo ?? null : null} more={note ? unread.length - 1 : 0} />
        )}
        {next && (
          <StartLink href={`/train/${next.kind}/${next.ref}`} seen={note?.id}
                     className="btn-primary btn-big pressable mt-4 w-full bg-on-surface-brand text-surface-brand">
            Start
          </StartLink>
        )}
        {weekDone && !gameDay && (
          week.more && !week.more.why ? <AddSession why={null} inBand />
          : speed ? <SpeedInvite trainer={trainer?.name ?? null} onBrand className="mt-4" />
          : null
        )}
        {!weekDone && <WeekStrip items={items} today={today} nextDay={next?.weekday ?? null} />}
        {meetLabel && (
          <p className="mt-2 text-[15px] font-semibold text-on-surface-brand-variant">
            Next with {trainer?.name ?? 'your trainer'}: {meetLabel}
          </p>
        )}
      </BrandBand>

      {items.length > 0 && (
        <>
          <div className="mb-3 mt-5 flex items-baseline justify-between gap-3">
            <h2 className="h-sec">Your week</h2>
            {set.length > 0 && <p className="text-[15px] font-bold text-on-surface-variant">{done} of {set.length} done</p>}
          </div>
          {/* Built like a drill in the session: the same tick mark, the same
              type, and the whole card lit on hover and press. The tick here is
              only a mark; the card opens the session, where the ticking is. */}
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.key} className="card card-press flex items-center gap-1.5 p-3">
                <Link href={`/train/${it.kind}/${it.ref}`} className="card-hit flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center"><TickMark on={it.done} /></span>
                  <span className="min-w-0 flex-1 py-2 pl-1.5 pr-1">
                    <span className="block text-[17px] font-bold leading-snug text-on-surface">{it.title}</span>
                    {/* How long, so a player can pick one that fits the time they have. */}
                    <span className="mt-1 block text-[16px] font-semibold text-on-surface-variant">
                      {it.minutes} min{!it.done && it.weekday < today ? ' · Missed' : ''}
                    </span>
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

      {/* With the week done, the band has it. */}
      {week.more && !weekDone && <AddSession why={week.more.why} />}

      {/* Asked once, here, because the answer moves the sessions above. After
          that it's a setting, and settings are on Me. */}
      {!schedule && items.some((i) => i.kind !== 'addon') && (
        <div className="mt-4"><SoccerDaysPanel days={null} /></div>
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
    <ol className="mt-3 flex max-w-sm justify-between" aria-label="This week">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
        const todo = items.filter((x) => !x.done && x.weekday === i);
        const doneHere = items.some((x) => x.done && (x.doneOn ?? x.weekday) === i);
        const isToday = i === today;
        const label = `${DAYS[i]}${isToday ? ' (today)' : ''}: ${todo.length ? `${todo.length} to do` : doneHere ? 'done' : 'rest'}`;
        return (
          <li key={i} aria-label={label} aria-current={isToday ? 'date' : undefined}
              className="flex w-10 flex-col items-center gap-1 rounded-full pb-1 pt-1"
              style={isToday ? { background: `color-mix(in srgb, ${ink} 18%, transparent)` } : undefined}>
            <span className="text-[12.5px] font-extrabold" style={{ color: ink, opacity: isToday ? 1 : 0.7 }}>{d}</span>
            <span className="flex h-6 w-6 items-center justify-center">
              {!todo.length && doneHere ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full"
                      style={{ background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }}>
                  <Tick className="h-3 w-3" />
                </span>
              ) : todo.length ? (
                <span className="h-6 w-6 rounded-full"
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

/**
 * A line from the trainer in the band: their face and their words, one line,
 * so Start and the week still fit on a small phone. A note opens the notes
 * page, where the rest of it is.
 */
function TrainerSays({ href, body, name, photo, more }: {
  href: string | null; body: string; name: string | null; photo: string | null; more: number;
}) {
  const inner = (
    <>
      {(name || photo) && <Avatar name={name} src={photo} className="h-9 w-9 text-[14px]" onBrand />}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-[16px] font-semibold leading-snug text-on-surface-brand">&ldquo;{body}&rdquo;</span>
        {more > 0 && <span className="mt-0.5 block text-[14px] font-semibold text-on-surface-brand-variant">+{more} more</span>}
      </span>
    </>
  );
  return href
    ? <Link href={href} className="pressable mt-3 flex items-center gap-3 rounded-xl">{inner}</Link>
    : <p className="mt-3 flex items-center gap-3">{inner}</p>;
}
