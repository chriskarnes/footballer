'use client';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState } from 'react';
import { PHASES, sessionSeconds, KIND_LABELS, type PhaseId } from '@/lib/speed';
import {
  isoDate, mondayOf, phaseForMonth, position, weekPlan, type DayPlan, type Position, type YearStart,
} from '@/lib/speed-year';
import { useYearStart } from '@/lib/use-year-start';
import { BandTag, BandTitle } from './BandText';
import { Chip } from './Chip';
import { ConfirmSheet } from './ConfirmSheet';
import { TickMark } from './TickMark';

const FULL_DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Completion = { source_ref: string | null; completed_at: string | null };
type Shared = {
  ready: boolean; start: YearStart | null; now: Date | null; save: (s: YearStart | null) => void;
  completions: Completion[];
  /** Whether the "start somewhere else" chooser is open. */
  choosing: boolean; setChoosing: (open: boolean) => void;
};
const SpeedContext = createContext<Shared | null>(null);

/**
 * Where the player is in the speed year, shared by the band at the top of
 * the Speed tab (SpeedNow), the week under it (SpeedWeek) and the start
 * controls in "For parents and coaches" (SpeedSetup). One reading of the
 * stored start, so starting in one place shows in all three.
 *
 * Done comes from finished speed sessions in history, so ticks need an
 * account; signed out, the year still runs, just without them.
 */
export function SpeedYearProvider({ completions, children }: { completions: Completion[]; children: React.ReactNode }) {
  const { start, ready, save } = useYearStart();
  // The date after mount: the server's clock isn't the player's.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  const [choosing, setChoosing] = useState(false);
  return (
    <SpeedContext.Provider value={{ ready: ready && !!now, start, now, save, completions, choosing, setChoosing }}>
      {children}
    </SpeedContext.Provider>
  );
}

type Running = Extract<Position, { state: 'running' }>;
type Training = Exclude<DayPlan, { type: 'off' }>;

/** This week of a running year: the days, which are done, today and the next one. */
function thisWeek(pos: Running, now: Date, completions: Completion[]) {
  const since = mondayOf(now).getTime();
  const doneRefs = new Set(completions
    .filter((c) => c.source_ref && c.completed_at && new Date(c.completed_at).getTime() >= since)
    .map((c) => c.source_ref!));
  const days = weekPlan(pos);
  const isDone = (d: DayPlan) => d.type === 'session' && doneRefs.has(d.session.id);
  const next = days.find((d): d is Training => d.weekday > pos.today && d.type !== 'off');
  return { days, isDone, today: days[pos.today], next };
}

function useSpeed() {
  const s = useContext(SpeedContext);
  if (!s) throw new Error('Speed parts go inside SpeedYearProvider');
  const pos = s.ready && s.start && s.now ? position(s.start, s.now) : null;
  return { ...s, pos };
}

/**
 * Where "Start my speed program" starts: at the phase the calendar says it
 * is (the phases follow the football year), this week, or from Thursday on
 * next Monday, since this week's first sessions would already be missed.
 */
function autoStart(now: Date): YearStart {
  const monday = mondayOf(now);
  if ((now.getDay() + 6) % 7 >= 3) monday.setDate(monday.getDate() + 7);
  return { monday: isoDate(monday), phase: phaseForMonth(monday) };
}

const href = (d: Training) => d.type === 'test' ? '/speed/test' : `/speed/session/${d.session.id}?from=speed`;
const minutes = (d: Extract<DayPlan, { type: 'session' }>) => Math.round(sessionSeconds(d.session) / 60);

/**
 * The band at the top of the Speed tab: what to do now, as Train's band does.
 * Today's session with Start, test day with Record, or a rest day and what's
 * next. Before the year has started, one button starts it; choosing another
 * starting point is a smaller link, for the adult who wants to.
 */
export function SpeedNow() {
  const s = useSpeed();
  const big = 'btn-primary btn-big pressable mt-5 w-full bg-on-surface-brand text-surface-brand';
  const info = 'mt-2 text-[16px] font-semibold text-on-surface-brand-variant';

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
        <button type="button" className={big} onClick={() => { s.setChoosing(false); s.save(autoStart(s.now!)); }}>
          Start my speed program
        </button>
        <button type="button" aria-expanded={s.choosing} onClick={() => s.setChoosing(!s.choosing)}
                className="pressable mt-2 min-h-12 text-[15px] font-semibold text-on-surface-brand-variant underline underline-offset-4">
          Parents and coaches: start somewhere else
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
        <p className={info}>{pos.startsOn.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })} · {phase.name}</p>
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

  const { today, next, isDone } = thisWeek(pos, s.now, s.completions);
  // Where they are in the year, in their words; the block and the week's
  // name are the planner's, in "For parents and coaches".
  const year = (
    <p className="mt-4 text-[15px] font-semibold text-on-surface-brand-variant">
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
  if (today.type === 'test') {
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
 *
 * Before the year starts this is the "start somewhere else" chooser, when
 * it's been opened.
 */
export function SpeedWeek() {
  const s = useSpeed();
  if (!s.ready || !s.now) return null;
  if (!s.start || !s.pos) {
    return s.choosing
      ? <StartYear now={s.now} onStart={(v) => { s.save(v); s.setChoosing(false); }} onCancel={() => s.setChoosing(false)} />
      : null;
  }
  if (s.pos.state !== 'running') return null;
  const pos = s.pos;
  const { days, isDone } = thisWeek(pos, s.now, s.completions);
  const training = days.filter((d) => d.type !== 'off');

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="h-sec">This week</h2>
        <p className="text-[15px] font-bold text-on-surface-variant">{training.filter(isDone).length} of {training.length} done</p>
      </div>
      <ul className="space-y-2.5">
        {days.map((d) => {
          // Today's row says so in a pill where the day's name would be.
          const day = d.weekday === pos.today
            ? <span className="mr-1 inline-block rounded-full bg-on-surface px-2.5 align-middle text-[14px] font-bold leading-6 text-surface">Today</span>
            : FULL_DAY[d.weekday];
          if (d.type === 'off') {
            return (
              <li key={d.day} className="flex min-h-12 items-center gap-1.5 px-3">
                <span className="flex w-[52px] shrink-0 items-center justify-center" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-outline" />
                </span>
                <span className="min-w-0 flex-1 pl-1.5 text-[15px] font-semibold text-on-surface-variant">{day} · {d.label}</span>
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
                  <span className="block text-[17px] font-bold leading-snug text-on-surface">
                    {d.type === 'test' ? 'Test day' : d.session.name}
                  </span>
                  <span className="mt-1 block text-[16px] font-semibold text-on-surface-variant">
                    {day} · {d.type === 'test' ? 'replaces Speed B' : `${KIND_LABELS[d.session.kind]} · ${minutes(d)} min`}
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

/**
 * In "For parents and coaches": where the year started, and starting it
 * again somewhere else. Starting again opens the chooser at the top.
 */
export function SpeedSetup() {
  const s = useSpeed();
  const [open, setOpen] = useState(false);
  if (!s.ready || !s.start) return null;
  const phase = PHASES.find((p) => p.id === s.start!.phase)!;
  const from = new Date(`${s.start.monday}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  return (
    <div className="card p-5">
      <p className="text-[16px] font-bold text-on-surface">Started at {phase.name}, week of {from}</p>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost pressable mt-4 min-h-12 w-full text-[15px] font-bold">
        Change where you started
      </button>
      <ConfirmSheet open={open} title="Change where you started?"
        body="You'll pick a phase and a start week again. Finished sessions and test days stay where they are."
        confirmLabel="Change it" onCancel={() => setOpen(false)}
        onConfirm={() => { s.save(null); s.setChoosing(true); setOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
    </div>
  );
}

/**
 * Starting somewhere else: which phase, and this week or next. The phase
 * starts at the one the calendar says it is, but a player starting from
 * nothing in May might want Foundation anyway. A setup question, so an
 * ordinary card, not the band.
 */
function StartYear({ now, onStart, onCancel }: {
  now: Date; onStart: (s: { monday: string; phase: PhaseId }) => void; onCancel: () => void;
}) {
  const [phase, setPhase] = useState<PhaseId>(phaseForMonth(now));
  const thisMonday = mondayOf(now);
  const nextMonday = new Date(thisMonday); nextMonday.setDate(nextMonday.getDate() + 7);
  const lateInWeek = (now.getDay() + 6) % 7 >= 3; // Thursday or later

  return (
    <div className="card animate-pop mt-5 p-5">
      <p className="h-card">Start somewhere else</p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-on-surface-variant">
        Pick a phase and the plan counts the weeks from there: each day&rsquo;s session, test days and blocks.
      </p>
      <p className="mb-2.5 mt-5 text-[15px] font-bold text-on-surface">Start at</p>
      <div className="flex flex-wrap gap-2">
        {PHASES.map((p) => (
          <Chip key={p.id} on={phase === p.id} onClick={() => setPhase(p.id)}>
            {p.number} · {p.name}
          </Chip>
        ))}
      </div>
      {/* Starting on a Thursday would make this week's Monday and Tuesday
          sessions already missed, so late in the week the default is Monday. */}
      <div className="mt-5 flex gap-2.5">
        <button type="button"
                onClick={() => onStart({ monday: isoDate(lateInWeek ? thisMonday : nextMonday), phase })}
                className="btn-ghost pressable min-h-[52px] min-w-0 flex-1 whitespace-nowrap px-4">
          {lateInWeek ? 'This week' : 'Next Monday'}
        </button>
        <button type="button"
                onClick={() => onStart({ monday: isoDate(lateInWeek ? nextMonday : thisMonday), phase })}
                className="btn-primary pressable min-w-0 flex-1 whitespace-nowrap px-4">
          {lateInWeek ? 'Start Monday' : 'Start this week'}
        </button>
      </div>
      <button type="button" onClick={onCancel}
              className="pressable mt-3 min-h-12 w-full text-[15px] font-semibold text-on-surface-variant underline underline-offset-4">
        Cancel
      </button>
    </div>
  );
}
