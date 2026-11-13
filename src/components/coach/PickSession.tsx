'use client';
import { useState, useTransition } from 'react';
import { placeSession } from '@/app/coach/content-actions';

type Row = { id: string; name: string; drills: number; minutes: number; here: boolean };

/** The trainer's sessions, each one tap from being in this program week. */
export function PickSession({ programId, week, sessions }: { programId: string; week: number; sessions: Row[] }) {
  const [busy, start] = useTransition();
  const [picked, setPicked] = useState('');
  const [err, setErr] = useState('');
  return (
    <>
      <ul className="card max-h-80 divide-y divide-outline-variant overflow-y-auto">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 pl-4 pr-3">
            <span className="min-w-0">
              <span className="block truncate text-body-lg font-semibold text-on-surface">{s.name}</span>
              <span className="block truncate text-body-sm text-on-surface-variant">
                {s.drills} {s.drills === 1 ? 'drill' : 'drills'} · {s.minutes} min{s.here && ' · already in this week'}
              </span>
            </span>
            <button type="button" disabled={busy} className="btn-ghost btn-sm pressable shrink-0"
                    onClick={() => { setPicked(s.id); setErr(''); start(async () => {
                      // On success the action redirects back to the program.
                      const r = await placeSession(s.id, programId, week);
                      if (r && !r.ok) setErr(r.error);
                    }); }}>
              {/* Twice in a week can be what the trainer wants; say it's a second copy. */}
              {busy && picked === s.id ? 'Adding…' : s.here ? 'Add again' : 'Add'}
            </button>
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-2 text-body font-semibold text-on-surface">{err}</p>}
    </>
  );
}
