'use client';
import { useState } from 'react';
import type { Exercise } from '@/lib/types';
import { FOCUS_LABELS, TOUCH_GOAL } from '@/lib/types';
import { formatTouches } from '@/lib/session-builder';
import { haptic } from '@/lib/haptics';
import { useWakeLock } from '@/lib/use-wake-lock';
import { BackLink } from './BackLink';

export function Runner({
  title, subtitle, drills, workoutId, sessionRef, back,
}: {
  title: string; subtitle: string; drills: Exercise[];
  workoutId?: string; sessionRef?: string;
  /** Where this session was opened from. The runner fills the screen and the tab
   *  bar does not lead back to the program, so without this it is a dead end. */
  back?: { href: string; label: string };
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const total = drills.reduce((a, d) => a + d.total_seconds, 0);
  const totalTouches = drills.reduce((a, d) => a + d.touches, 0);
  const doneTouches = drills.filter((d) => done.has(d.id)).reduce((a, d) => a + d.touches, 0);
  const pct = drills.length ? Math.round((done.size / drills.length) * 100) : 0;
  const allDone = drills.length > 0 && done.size === drills.length;

  // Hold the screen open until the session is finished. The phone is on the ground
  // against a cone for most of this.
  useWakeLock(!saved);

  const toggle = (id: string) =>
    setDone((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); haptic('tap'); }
      // The last drill gets the bigger buzz - it is the moment worth marking.
      else { n.add(id); haptic(n.size === drills.length ? 'success' : 'select'); }
      return n;
    });

  async function finish() {
    haptic('success');
    const payload = workoutId
      ? { id: workoutId, doneIds: [...done], actual_minutes: Math.round(total / 60), actual_touches: doneTouches }
      : { title, source: sessionRef ? 'library' : 'coach', source_ref: sessionRef,
          exercise_ids: drills.map((d) => d.id), planned_minutes: Math.round(total / 60),
          planned_touches: totalTouches, status: 'completed' };
    await fetch('/api/workouts', {
      method: workoutId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    setSaved(true);
  }

  return (
    <div className="animate-pop">
      {back && <BackLink href={back.href} label={back.label} />}
      <p className="eyebrow mb-3">{subtitle}</p>
      <h1 className="h-page">{title}</h1>

      {/* Live progress. Drills lead, touches follow.
          What a player is doing on this screen is working through a list, and
          the number that answers "how much is left" is the one they are
          actually moving — a drill at a time. Touches banked led before and
          could not do that job: it jumps 150 at a time, it is an estimate, and
          it never reaches a number anyone recognises as finished. The bar has
          always been drawn from the drill count, so the headline now agrees
          with the bar underneath it. */}
      <div key={allDone ? 'done' : 'going'}
           className={`mt-6 rounded-large-increased bg-surface-brand border border-brand-edge
                       p-6 shadow-level3 ${allDone ? 'celebrate' : ''}`}>
        <div className="flex items-end justify-between">
          <div className="flex items-end gap-3">
            {allDone && (
              <svg viewBox="0 0 24 24" aria-hidden="true"
                   className="mb-1 h-9 w-9 shrink-0 text-on-surface-brand"
                   fill="none" stroke="currentColor" strokeWidth="3"
                   strokeLinecap="round" strokeLinejoin="round">
                <path className="celebrate-tick" d="M20 6 9 17l-5-5" />
              </svg>
            )}
            <div>
              <div className="font-brand text-[40px] font-extrabold leading-none
                              tracking-tightest text-on-surface-brand">
                {done.size}<span className="text-on-surface-brand-variant">/{drills.length}</span>
              </div>
              <div className="mt-1.5 text-[12.5px] font-semibold text-on-surface-brand-variant">
                {allDone ? 'session complete' : 'completed drills'}
              </div>
            </div>
          </div>
          {/* Touches, at one weight and in the quiet tone. The banked count used
              to sit above this in bold white, which put a second headline
              number on a card that only has room for one. */}
          <div className="text-right text-[11.5px] font-semibold text-on-surface-brand-variant">
            {formatTouches(doneTouches)} of {formatTouches(totalTouches)} touches
          </div>
        </div>
        <div className="mt-5 h-[6px] overflow-hidden rounded-full bg-brand-track">
          <div className="h-full rounded-full bg-on-surface-brand transition-all duration-500"
               style={{ width: `${pct}%` }} />
        </div>
        {allDone && !saved && (
          /* The one primary button that sits ON the brand block, so its fill
              and label swap: a black button on a black card is not a button.
              It was `btn-gold` until recently — a class that stopped existing
              when the M3 migration renamed it, so the only button in the
              runner rendered as browser default for months. */
          <button onClick={finish}
                  className="btn-primary pressable mt-5 w-full bg-on-surface-brand text-surface-brand">
            Finish session
          </button>
        )}
        {saved && (
          <p className="mt-5 text-center text-[14px] font-bold text-on-surface-brand">Saved to your history</p>
        )}
      </div>

      <ol className="stagger mt-4 space-y-2.5">
        {drills.map((d) => {
          const on = done.has(d.id);
          return (
            <li key={d.id} onClick={() => toggle(d.id)}
                role="button" tabIndex={0} aria-pressed={on}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(d.id); }
                }}
                className={`card pressable flex cursor-pointer items-start gap-3.5 p-4
                            ${on ? 'opacity-45' : ''}`}>
              {/* A ticked drill is a selection, not a brand block, so it takes
                  the selection pair and flips with the scheme — same as a
                  chosen chip and the navigation pill. */}
              <div className={`mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center
                               rounded-[9px] border-2 transition
                               ${on ? 'border-secondary-container bg-transparent' : 'border-outline-variant bg-surface-container-low'}`}>
                {on && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-secondary-container" fill="none"
                       stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
                       strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`h-card ${on ? 'line-through' : ''}`}>{d.name}</div>
                <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
                  {d.sets} × {d.reps_time}{d.rest && d.rest !== '-' ? ` · rest ${d.rest}` : ''}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="tag tag-accent">{FOCUS_LABELS[d.primary_focus]}</span>
                  {!!d.touches && <span className="tag">{formatTouches(d.touches)} touches</span>}
                </div>
              </div>
              {d.video_url && (
                <a href={d.video_url} target="_blank" rel="noopener" aria-label="Watch demo"
                   onClick={(e) => e.stopPropagation()}
                   className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                              bg-surface-container-low text-on-surface">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
