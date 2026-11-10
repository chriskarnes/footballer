'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveDefaults } from '@/app/coach/plan-actions';
import { Chip } from '@/components/Chip';
import { MINUTE_CHOICES } from '@/lib/week-builder';
import type { Defaults } from '@/lib/academy-data';

/**
 * The academy's defaults for built weeks: how much every player trains
 * unless set on their own page, and whether weeks step drills up.
 */
export function BuildDefaults({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [sessions, setSessions] = useState(defaults.sessions);
  const [minutes, setMinutes] = useState(defaults.minutes);
  const [progress, setProgress] = useState(defaults.progress);
  const dirty = sessions !== defaults.sessions || minutes !== defaults.minutes || progress !== defaults.progress;

  const save = () => start(async () => {
    setErr('');
    const r = await saveDefaults(sessions, minutes, progress);
    if (!r.ok) setErr(r.error); else router.refresh();
  });

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-card">Built weeks</div>
        <span className="text-[13px] text-on-surface-variant">{sessions * minutes} min a week</span>
      </div>
      <p className="mt-1 text-[13.5px] leading-snug text-on-surface-variant">For every player, unless you change it on their page.</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <button type="button" className="icon-btn" aria-label="Fewer sessions" disabled={sessions <= 1} onClick={() => setSessions(sessions - 1)}>−</button>
          <span className="min-w-[7.5rem] text-center text-[15px] font-bold text-on-surface">{sessions} {sessions === 1 ? 'session' : 'sessions'} a week</span>
          <button type="button" className="icon-btn" aria-label="More sessions" disabled={sessions >= 7} onClick={() => setSessions(sessions + 1)}>+</button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Minutes per session">
          {MINUTE_CHOICES.map((m) => <Chip key={m} on={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="block text-[14px] font-bold text-on-surface">Step up week to week</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-on-surface-variant">
            {progress
              ? 'Drills a player handles get a little harder each built week, with a lighter week every fourth.'
              : 'Each built week starts fresh at every drill’s own amount. You set any step-ups.'}
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
      {err && <p role="alert" className="mt-3 text-[13px] font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
