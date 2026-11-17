'use client';
import { offline } from '@/lib/plain-error';
import { useState, useTransition } from 'react';
import { placeSessions } from '@/app/coach/content-actions';
import { TickMark } from '@/components/TickMark';

type Row = { id: string; name: string; drills: number; minutes: number; here: boolean };

/**
 * The trainer's sessions, to tick for this program week. Nothing is added
 * until the button at the bottom is pressed: tapping one used to add it and
 * leave for the program page, mid-way through picking.
 */
export function PickSession({ programId, week, sessions }: { programId: string; week: number; sessions: Row[] }) {
  const [busy, start] = useTransition();
  // In the order ticked: that's the order they go into the week.
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const flip = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const n = picked.length;
  return (
    <>
      <ul className="space-y-2.5">
        {sessions.map((s) => {
          const on = picked.includes(s.id);
          return (
            <li key={s.id}>
              <button type="button" role="checkbox" aria-checked={on} disabled={busy} onClick={() => { setErr(''); flip(s.id); }}
                      className={`card pressable flex w-full items-center gap-3 p-3 text-left ${on ? 'ring-2 ring-inset ring-primary' : ''}`}>
                <span className="shrink-0 scale-75"><TickMark on={on} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-lg font-semibold text-on-surface">{s.name}</span>
                  <span className="block truncate text-body-sm text-on-surface-variant">
                    {s.drills} {s.drills === 1 ? 'drill' : 'drills'} · {s.minutes} min{s.here && ' · already in this week'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {err && <p role="alert" className="mt-3 text-body font-semibold text-on-surface">{err}</p>}
      <button type="button" disabled={busy || !n} className="btn-primary pressable mt-6 w-full"
              onClick={() => start(async () => {
                setErr('');
                // On success the action goes back to the program, at this week.
                const r = await placeSessions(picked, programId, week).catch(offline);
                if (r && !r.ok) setErr(r.error);
              })}>
        {busy ? 'Adding…' : n ? `Add ${n} ${n === 1 ? 'session' : 'sessions'} to week ${week}` : 'Tick the sessions to add'}
      </button>
    </>
  );
}
