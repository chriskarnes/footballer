'use client';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState } from 'react';
import { PHASES, sessionSeconds, KIND_LABELS } from '@/lib/speed';
import {
  autoStart, mondayOf, position, weekPlan, type DayPlan, type Position, type YearStart,
} from '@/lib/speed-year';
import { useYearStart } from '@/lib/use-year-start';
import { localDay, useSpeedCard } from '@/lib/speed-card';
import { BandTag, BandTitle } from './BandText';
import { TickMark } from './TickMark';

const FULL_DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Completion = { source_ref: string | null; completed_at: string | null };
type Shared = {
  ready: boolean; start: YearStart | null; now: Date | null; save: (s: YearStart | null) => void;
  completions: Completion[];
};
const SpeedContext = createContext<Shared | null>(null);

/**
 * Where the player is in the speed year, shared by the band at the top of
 * the Speed tab (SpeedNow) and the week under it (SpeedWeek). One reading of
 * the stored start, so starting in the band shows in the week.
 *
 * Done comes from finished speed sessions in history, so ticks need an
 * account; signed out, the year still runs, just without them.
 */
export function SpeedYearProvider({ completions, children }: { completions: Completion[]; children: React.ReactNode }) {
  const { start, ready, save } = useYearStart();
  // The date after mount: the server's clock isn't the player's.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  return (
    <SpeedContext.Provider value={{ ready: ready && !!now, start, now, save, completions }}>
      {children}
    </SpeedContext.Provider>
  );
}

type Running = Extract<Position, { state: 'running' }>;
type Training = Exclude<DayPlan, { type: 'off' }>;

/** This week of a running year: the days, which are done, today and the next one. */
function thisWeek(pos: Running, now: Date, completions: Completion[], testDates: string[]) {
  const since = mondayOf(now).getTime();
  // Test day is done once the card has numbers from this week (its dates
  // are the player's own calendar days).
  const monday = localDay(mondayOf(now));
  const tested = testDates.some((d) => d >= monday);
  const doneRefs = new Set(completions
    .filter((c) => c.source_ref && c.completed_at && new Date(c.completed_at).getTime() >= since)
    .map((c) => c.source_ref!));
  const days = weekPlan(pos);
  const isDone = (d: DayPlan) => d.type === 'test' ? tested : d.type === 'session' && doneRefs.has(d.session.id);
  const next = days.find((d): d is Training => d.weekday > pos.today && d.type !== 'off');
  return { days, isDone, today: days[pos.today], next };
}

function useSpeed() {
  const s = useContext(SpeedContext);
  if (!s) throw new Error('Speed parts go inside SpeedYearProvider');
  const card = useSpeedCard();
  const pos = s.ready && s.start && s.now ? position(s.start, s.now) : null;
  return { ...s, pos, testDates: card.entries.map((e) => e.date) };
}

const href = (d: Training) => d.type === 'test' ? '/speed/test' : `/speed/session/${d.session.id}?from=speed`;
const minutes = (d: Extract<DayPlan, { type: 'session' }>) => Math.round(sessionSeconds(d.session) / 60);

/**
 * The band at the top of the Speed tab: what to do now, as Train's band does.
 * Today's session with Start, test day with Record, or a rest day and what's
 * next. Before the year has started, one button starts it, at the phase
 * the calendar says it is.
 */
export function SpeedNow() {
  const s = useSpeed();
  const big = 'btn-primary btn-on-brand btn-big pressable mt-5 w-full';
  const info = 'mt-2 text-title-sm font-semibold text-on-surface-brand-variant';

  // Until the stored start is read, the band holds its shape.
  if (!s.ready || !s.now) {
    return (
      <div aria-hidden className="invisible">
        <BandTag>Speed</BandTag><BandTitle>Speed</BandTitle><p className={info}>&nbsp;</p><span className={`${big} flex`}>&nbsp;</span>
      </div>
    );
  }

  if (!s.start || !s.pos) {
    return (
      <>
        <BandTag>Speed</BandTag>
        <BandTitle>Get faster</BandTitle>
        <p className={info}>A year of sessions to get faster, a few a week.</p>
        <button type="button" className={big} onClick={() => s.save(autoStart(s.now!))}>
          Start Speed
        </button>
      </>
    );
  }

  const pos = s.pos;
  if (pos.state === 'upcoming') {
    const phase = PHASES.find((p) => p.id === s.start!.phase)!;
    return (
      <>
        <BandTag>Next week</BandTag>
        <BandTitle>Starts Monday</BandTitle>
        <p className={info}>{pos.startsOn.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · {phase.name}</p>
      </>
    );
  }

  if (pos.state === 'finished') {
    return (
      <>
        <BandTag>Your year</BandTag>
        <BandTitle>Year done</BandTitle>
        <p className={info}>
          Two weeks off sprinting and jumping, then start again. This year&rsquo;s test numbers are next year&rsquo;s to beat.
        </p>
        <button type="button" className={big} onClick={() => s.save(null)}>Start a new year</button>
      </>
    );
  }

  const { today, next, isDone } = thisWeek(pos, s.now, s.completions, s.testDates);
  // Where they are in the year, in their words; the block and the week's
  // name are the planner's, in "For parents and coaches".
  const year = (
    <p className="mt-4 text-body-lg font-semibold text-on-surface-brand-variant">
      {pos.phase.name} · week {pos.weekOfYear + 1} of {pos.totalWeeks}
    </p>
  );

  if (today.type === 'session' && !isDone(today)) {
    return (
      <>
        <BandTag>Today</BandTag>
        <BandTitle>{today.session.name}</BandTitle>
        <p className={info}>{KIND_LABELS[today.session.kind]} · {minutes(today)} min</p>
        <Link href={href(today)} className={big}>Start</Link>
        {year}
      </>
    );
  }
  if (today.type === 'test' && !isDone(today)) {
    return (
      <>
        <BandTag>Today</BandTag>
        <BandTitle>Test day</BandTitle>
        <p className={info}>Warm up, then the five tests.</p>
        <Link href="/speed/test" className={big}>Record your tests</Link>
        {year}
      </>
    );
  }
  return (
    <>
      <BandTag>Today</BandTag>
      <BandTitle>{isDone(today) ? 'Done for today' : 'Rest day'}</BandTitle>
      <p className={info}>
        {next
          ? `Next: ${next.type === 'test' ? 'test day' : next.session.name}, ${FULL_DAY[next.weekday]}`
          : 'That’s the week. Next week starts Monday.'}
      </p>
      {year}
    </>
  );
}

/**
 * The week under the band, in Train's rows: a tick that fills when it's
 * done, the session's name, then the day in full, or a Today pill. A row
 * opens its session (or, done, what was done). Rest days are a quiet line,
 * so the week reads Monday to Sunday with today among the days around it.
 */
export function SpeedWeek() {
  const s = useSpeed();
  if (!s.ready || !s.now) return null;
  if (!s.start || !s.pos || s.pos.state !== 'running') return null;
  const pos = s.pos;
  const { days, isDone } = thisWeek(pos, s.now, s.completions, s.testDates);
  const training = days.filter((d) => d.type !== 'off');

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="h-sec">This week</h2>
        <p className="text-body-lg font-bold text-on-surface-variant">{training.filter(isDone).length} of {training.length} done</p>
      </div>
      <ul className="space-y-2.5">
        {days.map((d) => {
          // Today's row says so in a pill where the day's name would be.
          const day = d.weekday === pos.today
            ? <span className="mr-1 inline-block rounded-full bg-on-surface px-2.5 align-middle text-body font-bold leading-6 text-surface">Today</span>
            : FULL_DAY[d.weekday];
          if (d.type === 'off') {
            return (
              <li key={d.day} className="flex min-h-12 items-center gap-1.5 px-3">
                <span className="flex w-[52px] shrink-0 items-center justify-center" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-outline" />
                </span>
                <span className="min-w-0 flex-1 pl-1.5 text-body-lg font-semibold text-on-surface-variant">{day} · {d.label}</span>
              </li>
            );
          }
          const done = isDone(d);
          const missed = !done && d.type === 'session' && d.weekday < pos.today;
          return (
            <li key={d.day}>
              {/* Built like a drill in the session, as Train's week is. */}
              <Link href={href(d)} className="card pressable flex items-center gap-1.5 p-3">
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center"><TickMark on={done} /></span>
                <span className="min-w-0 flex-1 py-2 pl-1.5 pr-1">
                  <span className="block text-title font-bold leading-snug text-on-surface">
                    {d.type === 'test' ? 'Test day' : d.session.name}
                  </span>
                  <span className="mt-1 block text-title-sm font-semibold text-on-surface-variant">
                    {day} · {d.type === 'test' ? 'Five tests · about 45 min' : `${KIND_LABELS[d.session.kind]} · ${minutes(d)} min`}
                    {missed ? ' · Missed' : ''}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
