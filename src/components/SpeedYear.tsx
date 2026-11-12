'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PHASES, sessionSeconds, type PhaseId } from '@/lib/speed';
import {
  isoDate, mondayOf, phaseForMonth, position, weekPlan, type DayPlan,
} from '@/lib/speed-year';
import { useYearStart } from '@/lib/use-year-start';
import { Chip } from './Chip';
import { ConfirmSheet } from './ConfirmSheet';

const FULL_DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * The top of the Speed tab: where you are in the year, and what today is.
 *
 * The Plan tab's lesson, applied here. A 48-week program shown as a catalogue
 * leaves the athlete to work out the phase, block, week and session; this
 * does that arithmetic and leads with the answer — today's session with
 * Start, test day when it's due, or a day off and what's next — then the week
 * with what's already done ticked.
 *
 * Done comes from finished speed sessions in history, so ticks need an
 * account; signed out, the year still runs, just without them.
 */
export function SpeedYear({ completions }: { completions: { source_ref: string | null; completed_at: string | null }[] }) {
  const { start, ready, save } = useYearStart();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  const [restarting, setRestarting] = useState(false);

  if (!ready || !now) return null;
  if (!start) return <StartYear now={now} onStart={save} />;

  const pos = position(start, now);

  if (pos.state === 'upcoming') {
    return (
      <Card>
        <Eyebrow>Your year</Eyebrow>
        <Big>Starts Monday</Big>
        <p className="mt-2 text-[16px] font-semibold text-on-surface-brand-variant">
          {pos.startsOn.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
        </p>
        <RestartLink onClick={() => setRestarting(true)} />
        <Restart open={restarting} onCancel={() => setRestarting(false)} onConfirm={() => { save(null); setRestarting(false); }} />
      </Card>
    );
  }

  if (pos.state === 'finished') {
    return (
      <Card>
        <Eyebrow>Your year</Eyebrow>
        <Big>Year done</Big>
        <p className="mt-2 text-[16px] font-semibold leading-snug text-on-surface-brand-variant">
          Take two weeks off sprinting, then go again.
        </p>
        <button type="button" onClick={() => save(null)}
                className="btn-primary btn-big pressable mt-5 w-full bg-on-surface-brand text-surface-brand">
          Start a new year
        </button>
      </Card>
    );
  }

  const since = mondayOf(now).getTime();
  const doneRefs = completions
    .filter((c) => c.source_ref && c.completed_at && new Date(c.completed_at).getTime() >= since)
    .map((c) => c.source_ref!);
  const days = weekPlan(pos);
  const isDone = (d: DayPlan) => d.type === 'session' && doneRefs.includes(d.session.id);
  const training = days.filter((d) => d.type !== 'off');
  const doneCount = training.filter(isDone).length;
  const today = days[pos.today];
  const next = days.find((d): d is Exclude<DayPlan, { type: 'off' }> => d.weekday > pos.today && d.type !== 'off');

  // The card answers one question — what do I do now — and in this order:
  // the session, how long, the button. Where you are in the year is the
  // footer, in the player's words ("Foundation, week 1 of 48"); the block
  // number and the week's name ("learn") are the planner's arithmetic and
  // live on the phase page. Week progress is the dots, not a bar and a
  // count and a week number saying it three times — and the list below
  // ticks off each day anyway.
  return (
    <>
      <Card>
        {today.type === 'session' && !isDone(today) && (
          <>
            <Eyebrow>Today</Eyebrow>
            <Big>{today.session.name}</Big>
            <p className="mt-1.5 text-[16px] font-semibold text-on-surface-brand-variant">
              {Math.round(sessionSeconds(today.session) / 60)} min
            </p>
            <Link href={`/speed/session/${today.session.id}?from=speed`}
                  className="btn-primary btn-big pressable mt-5 w-full bg-on-surface-brand text-surface-brand">
              Start
            </Link>
          </>
        )}

        {today.type === 'test' && (
          <>
            <Eyebrow>Today</Eyebrow>
            <Big>Test day</Big>
            <p className="mt-1.5 text-[16px] font-semibold text-on-surface-brand-variant">
              Warm up, then do the five tests.
            </p>
            <Link href="/speed/test"
                  className="btn-primary btn-big pressable mt-5 w-full bg-on-surface-brand text-surface-brand">
              Start my tests
            </Link>
          </>
        )}

        {(today.type === 'off' || isDone(today)) && (
          <>
            <Big>{isDone(today) ? 'Done for today' : 'Rest day'}</Big>
            <p className="mt-1.5 text-[16px] font-semibold text-on-surface-brand-variant">
              {next
                ? `Next: ${FULL_DAY[next.weekday]}`
                : 'Week done. See you Monday.'}
            </p>
          </>
        )}

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-brand-track pt-4">
          <span className="truncate text-[14px] font-semibold text-on-surface-brand-variant">
            Week {pos.weekOfYear + 1} of {pos.totalWeeks}
          </span>
          <span className="flex shrink-0 gap-1.5" role="img" aria-label={`${doneCount} of ${training.length} done this week`}>
            {training.map((d) => (
              <span key={d.day} className={`h-3 w-3 rounded-full ${isDone(d) ? 'bg-brand-accent' : 'bg-brand-track'}`} />
            ))}
          </span>
        </div>
      </Card>

      {/* The week, Monday to Sunday, so today sits among the days around it. */}
      <h2 className="h-sec mb-3 mt-8">This week</h2>
      <ol className="space-y-2.5">
        {days.map((d) => {
          const isToday = d.weekday === pos.today;
          const done = isDone(d);
          if (d.type === 'off') {
            return (
              <li key={d.day} className="flex items-center gap-3.5 px-4 py-1.5">
                <DayLabel day={d.day} today={isToday} muted />
                <span className="text-[15px] font-medium text-on-surface-variant">Rest</span>
              </li>
            );
          }
          return (
            <li key={d.day} className={`card flex min-h-[68px] items-center gap-3.5 p-4 ${done ? 'opacity-60' : ''} ${isToday && !done ? 'ring-2 ring-on-surface' : ''}`}>
              <DayLabel day={d.day} today={isToday} />
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-bold leading-snug text-on-surface">{d.type === 'test' ? 'Test day' : d.session.name}</div>
                <div className="mt-0.5 text-[13.5px] font-semibold text-on-surface-variant">
                  {d.type === 'test' ? 'Five tests' : `${Math.round(sessionSeconds(d.session) / 60)} min`}
                </div>
              </div>
              {done ? (
                <span className="flex shrink-0 items-center gap-1 text-[14px] font-bold text-on-surface-variant">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true"
                       stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Done
                </span>
              ) : (
                <Link href={d.type === 'test' ? '/speed/test' : `/speed/session/${d.session.id}?from=speed`}
                      className="btn-primary btn-sm shrink-0">
                  Start
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 text-right">
        <RestartLink onClick={() => setRestarting(true)} muted />
      </div>
      <Restart open={restarting} onCancel={() => setRestarting(false)}
               onConfirm={() => { save(null); setRestarting(false); }} />
    </>
  );
}

/**
 * Starting the year: which phase, and this week or next. The phase defaults to
 * the one the calendar says it is, because the phases follow the football year
 * — but a player starting from nothing in May might want Foundation anyway.
 */
function StartYear({ now, onStart }: { now: Date; onStart: (s: { monday: string; phase: PhaseId }) => void }) {
  const [phase, setPhase] = useState<PhaseId>(phaseForMonth(now));
  const thisMonday = mondayOf(now);
  const nextMonday = new Date(thisMonday); nextMonday.setDate(nextMonday.getDate() + 7);
  const lateInWeek = (now.getDay() + 6) % 7 >= 3; // Thursday or later

  // The brand block: starting is the one thing to do here. The calendar picks
  // the phase; choosing another is there for the few who want it, folded away.
  const [choosing, setChoosing] = useState(false);
  return (
    <Card>
      <Big>Ready to get faster?</Big>
      <p className="mt-1.5 text-[16px] font-semibold text-on-surface-brand-variant">
        Short speed sessions, a few times a week.
      </p>
      {/* Starting on a Thursday would make Monday's and Tuesday's sessions
          already missed, so late in the week the big button is next Monday. */}
      <button type="button"
              onClick={() => onStart({ monday: isoDate(lateInWeek ? nextMonday : thisMonday), phase })}
              className="btn-primary btn-big pressable mt-5 w-full bg-on-surface-brand text-surface-brand">
        {lateInWeek ? 'Start on Monday' : 'Start this week'}
      </button>
      <button type="button"
              onClick={() => onStart({ monday: isoDate(lateInWeek ? thisMonday : nextMonday), phase })}
              className="btn-ghost pressable mt-2.5 min-h-[52px] w-full border-on-surface-brand-variant text-[15px] font-bold text-on-surface-brand">
        {lateInWeek ? 'Start this week' : 'Start next Monday'}
      </button>
      {choosing ? (
        <div className="hint-in mt-5 rounded-2xl bg-surface-container-lowest p-4">
          <p className="mb-2.5 text-[15px] font-bold text-on-surface">Start at</p>
          <div className="flex flex-wrap gap-2">
            {PHASES.map((p) => (
              <Chip key={p.id} on={phase === p.id} onClick={() => setPhase(p.id)}>{p.name}</Chip>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setChoosing(true)}
                className="pressable mt-4 text-[14px] font-semibold text-on-surface-brand-variant underline underline-offset-4">
          Starting at {PHASES.find((p) => p.id === phase)!.name}. Change
        </button>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-pop mt-6 rounded-large-increased border border-brand-edge bg-surface-brand p-6 shadow-level3">
      {children}
    </div>
  );
}
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-[15px] font-extrabold text-brand-accent">{children}</p>
);
const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="font-brand text-[30px] font-extrabold leading-tight tracking-tight text-on-surface-brand">{children}</p>
);

function DayLabel({ day, today, muted }: { day: string; today: boolean; muted?: boolean }) {
  return (
    <span className={`w-11 shrink-0 font-brand text-[15px] font-extrabold
                      ${muted && !today ? 'text-on-surface-variant' : 'text-on-surface'}`}>
      {day}
      {today && <span className="block text-[11.5px] font-bold text-on-surface-variant">Today</span>}
    </span>
  );
}

function RestartLink({ onClick, muted }: { onClick: () => void; muted?: boolean }) {
  return (
    <button type="button" onClick={onClick}
            className={`pressable mt-3 text-[13px] font-semibold underline underline-offset-4
                        ${muted ? 'text-on-surface-variant' : 'text-on-surface-brand-variant'}`}>
      Start over
    </button>
  );
}

function Restart({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ConfirmSheet open={open} title="Start over?"
      body="You'll pick where to start again. Sessions you've finished stay finished."
      confirmLabel="Start over" onConfirm={onConfirm} onCancel={onCancel} />
  );
}

