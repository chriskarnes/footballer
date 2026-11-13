'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BuiltSession } from '@/lib/types';
import { formatTouches } from '@/lib/session-builder';
import { sessionTitle } from '@/lib/session-url';

export function SessionCard({
  built, startHref, onSwap, onShuffle,
}: {
  built: BuiltSession;
  /** Where Start goes — the runner, carrying this exact session. */
  startHref: string;
  onSwap: (i: number) => void; onShuffle: () => void;
}) {
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'signin' | 'error'>('idle');
  const mins = Math.round(built.totalSeconds / 60);

  // "Saved" describes these drills. After a swap or another mix it's a different
  // session, and the button has to be pressable again.
  const ids = built.drills.map((d) => d.id).join();
  useEffect(() => { setSaving((s) => (s === 'saved' ? 'idle' : s)); }, [ids]);

  async function save() {
    setSaving('saving');
    const res = await fetch('/api/workouts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: sessionTitle(built.spec),
        // Rounds ride in the spec, so the session runs the same way from history.
        source: 'coach', spec: { ...built.spec, rounds: built.rounds },
        exercise_ids: built.drills.map((d) => d.id),
        planned_minutes: mins, planned_touches: built.totalTouches,
      }),
    }).catch(() => null);
    setSaving(res?.status === 401 ? 'signin' : res?.ok ? 'saved' : 'error');
  }

  return (
    <div>
      {/* What it is in one line, and the one thing this screen is for. */}
      <div className="brand-card p-6">
        <p className="font-brand text-display-sm font-extrabold leading-tight tracking-brand-snug text-on-surface-brand">
          {mins} min · {built.drills.length} {built.drills.length === 1 ? 'drill' : 'drills'}{built.rounds > 1 ? ` × ${built.rounds}` : ''}
        </p>
        {!!built.totalTouches && (
          <p className="mt-1 text-body-lg font-semibold text-on-surface-brand-variant">
            {formatTouches(built.totalTouches)} touches on the ball
          </p>
        )}
        <Link href={startHref}
              className="btn-primary btn-on-brand btn-big pressable mt-5 w-full">
          Start
        </Link>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button onClick={onShuffle}
                  className="btn-ghost pressable border-on-surface-brand-variant font-bold text-on-surface-brand">
            Mix it up
          </button>
          <button onClick={save} disabled={saving === 'saving' || saving === 'saved'}
                  className="btn-ghost pressable border-on-surface-brand-variant font-bold text-on-surface-brand disabled:cursor-default">
            {saving === 'saved' ? 'Saved' : 'Save for later'}
          </button>
        </div>
        {saving === 'error' && (
          <p role="alert" className="mt-3 text-body font-medium text-on-surface-brand">Couldn&rsquo;t save it. Try again.</p>
        )}
        {saving === 'signin' && (
          <p role="status" className="mt-3 text-body font-medium text-on-surface-brand-variant">
            <Link href="/me" className="font-bold text-on-surface-brand underline underline-offset-4">Sign in</Link> to save sessions.
          </p>
        )}
      </div>

      <ol className="stagger mt-6 space-y-2.5">
        {built.drills.map((d, i) => (
          <li key={d.id} className="card flex items-center gap-3 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-brand text-body font-extrabold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-title-sm font-bold leading-snug text-on-surface">{d.name}</div>
              <div className="mt-0.5 text-body font-semibold text-on-surface-variant">
                {d.sets} × {d.reps_time}
              </div>
            </div>
            {d.video_url && (
              <a href={d.video_url} target="_blank" rel="noopener" aria-label={`Watch ${d.name}`}
                 className="icon-btn pressable h-11 w-11">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </a>
            )}
            <button onClick={() => onSwap(i)} aria-label={`Swap ${d.name} for another drill`}
              className="icon-btn pressable h-11 w-11 text-on-surface-variant hover:text-on-surface">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true"
                   stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 8h13l-3-3M20 16H7l3 3" />
              </svg>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
