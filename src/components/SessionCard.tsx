'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { BuiltSession } from '@/lib/types';
import { FOCUS_LABELS, TOUCH_GOAL } from '@/lib/types';
import { formatTouches } from '@/lib/session-builder';

export function SessionCard({
  built, onSwap, onShuffle,
}: { built: BuiltSession; onSwap: (i: number) => void; onShuffle: () => void }) {
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'signin'>('idle');
  const mins = Math.round(built.totalSeconds / 60);
  const pct = Math.min(100, Math.round((built.totalTouches / TOUCH_GOAL) * 100));
  const hit = built.totalTouches >= TOUCH_GOAL;

  async function save() {
    setSaving('saving');
    const res = await fetch('/api/workouts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `${built.spec.minutes}-min ${built.spec.focus.map((f) => FOCUS_LABELS[f]).join(' + ')}`,
        source: 'coach', spec: built.spec,
        exercise_ids: built.drills.map((d) => d.id),
        planned_minutes: mins, planned_touches: built.totalTouches,
      }),
    });
    setSaving(res.status === 401 ? 'signin' : res.ok ? 'saved' : 'idle');
  }

  if (!built.drills.length) {
    return <div className="card p-6 text-[15px] text-on-surface-variant">
      Nothing matched — try a longer session or a different place.
    </div>;
  }

  return (
    <div>
      {/* The headline number gets the space it deserves — and now the whole card,
          since "Your session" is a heading above this box rather than a second,
          smaller label repeating it inside. */}
      <div className="overflow-hidden rounded-large-increased bg-inverse-surface p-6 shadow-level3">
        <div className="flex items-end gap-6">
          <div>
            <div className="font-brand text-[46px] font-extrabold leading-none
                            tracking-tightest text-inverse-primary">
              {formatTouches(built.totalTouches)}
            </div>
            <div className="mt-1.5 text-[12.5px] font-semibold text-app-inverse-on-surface-variant">ball touches</div>
          </div>
          <div className="mb-1 flex gap-6">
            <Metric v={`${mins}`} unit="min" />
            <Metric v={`${built.drills.length}`} unit={built.rounds > 1 ? `× ${built.rounds}` : 'drills'} />
          </div>
        </div>

        <div className="mt-5 h-[6px] overflow-hidden rounded-full bg-app-inverse-outline-variant">
          <div className="h-full rounded-full bg-inverse-primary transition-all duration-700"
               style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2.5 text-[12px] font-medium text-app-inverse-on-surface-variant">
          {hit
            ? `Past the ${TOUCH_GOAL.toLocaleString()} goal — a team practice gives most players a few hundred.`
            : `${formatTouches(TOUCH_GOAL - built.totalTouches)} short of ${TOUCH_GOAL.toLocaleString()}.`}
        </p>
      </div>

      <ol className="stagger mt-4 space-y-2.5">
        {built.drills.map((d, i) => (
          <li key={d.id} className="card p-4">
            <div className="flex items-start gap-3.5">
              <span className="mt-0.5 font-brand text-[13px] font-bold text-on-surface-variant">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="h-card">{d.name}</div>
                <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
                  {d.sets} × {d.reps_time}{d.rest && d.rest !== '-' ? ` · rest ${d.rest}` : ''}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="tag tag-accent">{FOCUS_LABELS[d.primary_focus]}</span>
                  {!!d.touches && <span className="tag tag-accent">{formatTouches(d.touches)} touches</span>}
                  <span className="tag">{d.equipment.join(' · ') || 'no kit'}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-brand text-[15px] font-bold tracking-tighter">
                  {d.total_seconds < 60 ? `${d.total_seconds}s` : `${Math.round(d.total_seconds / 60)}m`}
                </span>
                <div className="flex gap-1.5">
                  {d.video_url && (
                    <a href={d.video_url} target="_blank" rel="noopener" aria-label="Watch demo"
                       className="flex h-8 w-8 items-center justify-center rounded-full
                                  bg-surface-container-low text-on-surface transition active:scale-90">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </a>
                  )}
                  <button onClick={() => onSwap(i)} aria-label="Swap this drill"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low
                               text-on-surface-variant transition active:scale-90 hover:text-on-surface">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"
                         stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M4 8h13l-3-3M20 16H7l3 3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex gap-2.5">
        <button onClick={onShuffle} className="btn-ghost flex-1">Another mix</button>
        <button onClick={save} disabled={saving === 'saving'} className="btn-ghost flex-1">
          {saving === 'saved' ? 'Saved ✓' : saving === 'signin' ? 'Sign in to save' : 'Save'}
        </button>
      </div>
      {saving === 'signin' && (
        <p className="mt-3 text-center text-[13px] text-on-surface-variant">
          <Link href="/me" className="font-bold text-primary">Create an account</Link> to keep
          your history and repeat sessions.
        </p>
      )}
    </div>
  );
}

function Metric({ v, unit }: { v: string; unit: string }) {
  return (
    <div>
      <div className="font-brand text-[22px] font-bold leading-none tracking-tighter text-inverse-on-surface">{v}</div>
      <div className="mt-1 text-[11.5px] font-semibold text-app-inverse-on-surface-variant">{unit}</div>
    </div>
  );
}
