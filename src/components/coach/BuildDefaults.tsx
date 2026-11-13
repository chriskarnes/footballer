'use client';
import { offline } from '@/lib/plain-error';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/coach/Toast';
import { useRouter } from 'next/navigation';
import { saveDefaults } from '@/app/coach/plan-actions';
import { Chip } from '@/components/Chip';
import { MINUTE_CHOICES } from '@/lib/week-builder';
import type { Defaults } from '@/lib/academy-data';

/**
 * The academy's defaults for custom weeks: how much every player trains
 * unless set on their own page, and whether drills level up. With how much
 * AI the academy has used this month.
 */
export function BuildDefaults({ defaults, ai }: { defaults: Defaults; ai: { used: number; limit: number; on: boolean } | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [sessions, setSessions] = useState(defaults.sessions);
  const [minutes, setMinutes] = useState(defaults.minutes);
  const [progress, setProgress] = useState(defaults.progress);
  const dirty = sessions !== defaults.sessions || minutes !== defaults.minutes || progress !== defaults.progress;

  const save = () => start(async () => {
    setErr('');
    const r = await saveDefaults(sessions, minutes, progress).catch(offline);
    if (!r.ok) setErr(r.error); else { toast('Saved.'); router.refresh(); }
  });

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-card">Custom weeks</div>
        <span className="text-body text-on-surface-variant">{sessions * minutes} min a week</span>
      </div>
      <p className="mt-1 text-body leading-snug text-on-surface-variant">For every player, unless you change it on their page.</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <button type="button" className="icon-btn" aria-label="Fewer sessions" disabled={sessions <= 1} onClick={() => setSessions(sessions - 1)}>−</button>
          <span className="min-w-[7.5rem] text-center text-body-lg font-bold text-on-surface">{sessions} {sessions === 1 ? 'session' : 'sessions'} a week</span>
          <button type="button" className="icon-btn" aria-label="More sessions" disabled={sessions >= 7} onClick={() => setSessions(sessions + 1)}>+</button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Minutes per session">
          {MINUTE_CHOICES.map((m) => <Chip key={m} on={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="block text-body font-bold text-on-surface">Level up week to week</span>
          <span className="mt-0.5 block text-body-sm leading-snug text-on-surface-variant">
            {progress
              ? 'Drills a player handles go up a level each week, with a lighter week every fourth.'
              : 'Every drill stays at its own amount. You set levels yourself.'}
          </span>
        </span>
        <input type="checkbox" role="switch" className="mt-1 h-5 w-5 shrink-0 accent-current" checked={progress}
               onChange={(e) => setProgress(e.target.checked)} />
      </label>

      {dirty && (
        <button type="button" disabled={pending} onClick={save} className="btn-primary pressable mt-5 w-full">
          {pending ? 'Saving…' : 'Save'}
        </button>
      )}
      {ai && (
        <div className="mt-5 border-t border-outline-variant pt-4">
          <div className="flex items-baseline justify-between gap-3 text-body">
            <span className="font-bold text-on-surface">AI this month</span>
            <span className="text-on-surface-variant">{ai.on ? `${ai.used} of ${ai.limit}` : 'Not set up'}</span>
          </div>
          {ai.on && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-highest" aria-hidden>
              <div className="h-full rounded-full bg-on-surface" style={{ width: `${Math.min(100, (ai.used / ai.limit) * 100)}%` }} />
            </div>
          )}
          <p className="mt-2 text-body-sm leading-snug text-on-surface-variant">
            {ai.on ? 'Builds and suggestions. Past the limit, weeks are still built, just without AI.'
              : 'Weeks are built from each player’s settings.'}
          </p>
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-body font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
