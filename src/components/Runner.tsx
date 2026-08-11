'use client';
import { useState } from 'react';
import type { Exercise } from '@/lib/types';
import { FOCUS_LABELS, TOUCH_GOAL } from '@/lib/types';
import { formatTouches } from '@/lib/session-builder';
import { haptic } from '@/lib/haptics';
import { useWakeLock } from '@/lib/use-wake-lock';

export function Runner({
  title, subtitle, drills, workoutId, sessionRef,
}: {
  title: string; subtitle: string; drills: Exercise[];
  workoutId?: string; sessionRef?: string;
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
      <p className="eyebrow mb-3">{subtitle}</p>
      <h1 className="h-page">{title}</h1>

      {/* live progress, dark so the number carries */}
      <div className="mt-6 rounded-card bg-ink p-6 shadow-lift">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-display text-[40px] font-extrabold leading-none
                            tracking-tightest text-gold">
              {formatTouches(doneTouches).replace('~', '')}
            </div>
            <div className="mt-1.5 text-[12.5px] font-semibold text-white/55">touches banked</div>
          </div>
          <div className="text-right">
            <div className="font-display text-[20px] font-bold tracking-tighter text-white">
              {done.size}<span className="text-white/40">/{drills.length}</span>
            </div>
            <div className="mt-1 text-[11.5px] font-semibold text-white/45">
              of {formatTouches(totalTouches)}
            </div>
          </div>
        </div>
        <div className="mt-5 h-[6px] overflow-hidden rounded-pill bg-white/12">
          <div className="h-full rounded-pill bg-gold transition-all duration-500"
               style={{ width: `${pct}%` }} />
        </div>
        {allDone && !saved && (
          <button onClick={finish} className="btn-gold mt-5 w-full">Finish session</button>
        )}
        {saved && (
          <p className="mt-5 text-center text-[14px] font-bold text-gold">Saved to your history</p>
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
              <div className={`mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center
                               rounded-[9px] border-2 transition
                               ${on ? 'border-gold bg-gold' : 'border-line bg-surface2'}`}>
                {on && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-ink" fill="none"
                       stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
                       strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`h-card ${on ? 'line-through' : ''}`}>{d.name}</div>
                <div className="mt-1 text-[12.5px] font-medium text-muted">
                  {d.sets} × {d.reps_time}{d.rest && d.rest !== '-' ? ` · rest ${d.rest}` : ''}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="tag tag-gold">{FOCUS_LABELS[d.primary_focus]}</span>
                  {!!d.touches && <span className="tag">{formatTouches(d.touches)} touches</span>}
                </div>
              </div>
              {d.video_url && (
                <a href={d.video_url} target="_blank" rel="noopener" aria-label="Watch demo"
                   onClick={(e) => e.stopPropagation()}
                   className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                              bg-surface2 text-body transition active:scale-90">
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
