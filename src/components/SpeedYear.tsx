'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PHASES, sessionSeconds, KIND_LABELS, type PhaseId } from '@/lib/speed';
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
        <p className="mt-2 text-[13.5px] font-medium text-on-surface-brand-variant">
          {pos.startsOn.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })} · Phase{' '}
          {PHASES.find((p) => p.id === start.phase)!.number}, {PHASES.find((p) => p.id === start.phase)!.name}
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
        <p className="mt-2 text-[13.5px] leading-relaxed text-on-surface-brand-variant">
          Two weeks off sprinting and plyometrics, then start again at Phase 1 — this year&rsquo;s
          test numbers are next year&rsquo;s baseline.
        </p>
        <button type="button" onClick={() => save(null)}
                className="btn-primary pressable mt-5 w-full bg-on-surface-brand text-surface-brand">
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
            <p className="mt-1 text-[14px] font-medium text-on-surface-brand-variant">
              {Math.round(sessionSeconds(today.session) / 60)} min · {KIND_LABELS[today.session.kind]}
            </p>
            <Link href={`/speed/session/${today.session.id}?from=speed`}
                  className="btn-primary pressable mt-6 w-full bg-on-surface-brand text-surface-brand">
              Start
            </Link>
          </>
        )}

        {today.type === 'test' && (
          <>
            <Eyebrow>Today</Eyebrow>
            <Big>Test day</Big>
            <p className="mt-1 text-[14px] font-medium text-on-surface-brand-variant">
              Warm up, then the five tests.
            </p>
            <Link href="/speed/test"
                  className="btn-primary pressable mt-6 w-full bg-on-surface-brand text-surface-brand">
              Record your tests
            </Link>
          </>
        )}

        {(today.type === 'off' || isDone(today)) && (
          <>
            <Big>{isDone(today) ? 'Done for today' : 'Rest day'}</Big>
            <p className="mt-1 text-[14px] font-medium text-on-surface-brand-variant">
              {next
                ? `Next: ${next.type === 'test' ? 'test day' : next.session.name}, ${FULL_DAY[next.weekday]}`
                : 'That’s the week. Next week starts Monday.'}
            </p>
          </>
        )}

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-brand-track pt-4">
          <span className="truncate text-[12.5px] font-medium text-on-surface-brand-variant">
            {pos.phase.name} · week {pos.weekOfYear + 1} of {pos.totalWeeks}
          </span>
          <span className="flex shrink-0 gap-1.5" role="img" aria-label={`${doneCount} of ${training.length} done this week`}>
            {training.map((d) => (
              <span key={d.day} className={`h-2 w-2 rounded-full ${isDone(d) ? 'bg-brand-accent' : 'bg-brand-track'}`} />
            ))}
          </span>
        </div>
      </Card>

      {/* The week, Monday to Sunday, so today sits among the days around it. */}
      <ol className="mt-3 space-y-2">
        {days.map((d) => {
          const isToday = d.weekday === pos.today;
          const done = isDone(d);
          if (d.type === 'off') {
            return (
              <li key={d.day} className="flex items-center gap-3.5 px-4 py-2">
                <DayLabel day={d.day} today={isToday} muted />
                <span className="text-[13.5px] text-on-surface-variant">{d.label}</span>
              </li>
            );
          }
          return (
            <li key={d.day} className={`card flex items-center gap-3.5 p-4 ${done ? 'opacity-60' : ''}`}>
              <DayLabel day={d.day} today={isToday} />
              <div className="min-w-0 flex-1">
                <div className="h-card truncate">{d.type === 'test' ? 'Test day' : d.session.name}</div>
                <div className="mt-0.5 text-[12.5px] text-on-surface-variant">
                  {d.type === 'test'
                    ? 'Replaces Speed B this week'
                    : `${KIND_LABELS[d.session.kind]} · ${Math.round(sessionSeconds(d.session) / 60)} min`}
                </div>
              </div>
              {done ? (
                <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-on-surface-variant">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true"
                       stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Done
                </span>
              ) : (
                <Link href={d.type === 'test' ? '/speed/test' : `/speed/session/${d.session.id}?from=speed`}
                      className="btn-primary btn-sm shrink-0">
                  {d.type === 'test' ? 'Record' : 'Start'}
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

  // An ordinary card, not the brand block: the brand block is the "do this
  // now" surface, and choosing a starting point is a setup question. The
  // chips here are the same chips as everywhere else.
  return (
    <div className="card animate-pop mt-7 p-5">
      <p className="h-card">Start the program</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-on-surface-variant">
        Pick where to begin and the plan counts the weeks: today&rsquo;s session, test days and
        blocks, without working out which of the 60 it is.
      </p>
      <p className="mb-2.5 mt-5 text-[14px] font-bold text-on-surface">Start at</p>
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
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-pop mt-7 rounded-large-increased border border-brand-edge bg-surface-brand p-6 shadow-level3">
      {children}
    </div>
  );
}
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">{children}</p>
);
const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="font-brand text-[30px] font-extrabold leading-tight tracking-tight text-on-surface-brand">{children}</p>
);

function DayLabel({ day, today, muted }: { day: string; today: boolean; muted?: boolean }) {
  return (
    <span className={`w-10 shrink-0 font-brand text-[13px] font-bold
                      ${muted && !today ? 'text-on-surface-variant' : 'text-on-surface'}`}>
      {day}
      {today && <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Today</span>}
    </span>
  );
}

function RestartLink({ onClick, muted }: { onClick: () => void; muted?: boolean }) {
  return (
    <button type="button" onClick={onClick}
            className={`pressable mt-3 text-[13px] font-semibold underline underline-offset-4
                        ${muted ? 'text-on-surface-variant' : 'text-on-surface-brand-variant'}`}>
      Change where you started
    </button>
  );
}

function Restart({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ConfirmSheet open={open} title="Change where you started?"
      body="You'll pick a phase and a start week again. Finished sessions and test days stay where they are."
      confirmLabel="Change it" onConfirm={onConfirm} onCancel={onCancel} />
  );
}

