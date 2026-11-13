'use client';
import { offline } from '@/lib/plain-error';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/coach/Toast';
import { useRouter } from 'next/navigation';
import { savePlayerOptions } from '@/app/coach/plan-actions';
import { Chip } from '@/components/Chip';

/**
 * What players may do on their own: browse the academy's library, add a
 * session when they have time (built by rules from their own settings), and
 * have Speed & Stamina, which is on unless the trainer turns it off.
 */
export function PlayerOptions({ library: savedLibrary, extras: savedExtras, speed: savedSpeed }: {
  library: boolean; extras: number; speed: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [library, setLibrary] = useState(savedLibrary);
  const [extras, setExtras] = useState(savedExtras);
  const [speed, setSpeed] = useState(savedSpeed);
  const dirty = library !== savedLibrary || extras !== savedExtras || speed !== savedSpeed;

  const save = () => start(async () => {
    setErr('');
    const r = await savePlayerOptions(library, extras, speed).catch(offline);
    if (!r.ok) setErr(r.error); else { toast('Saved.'); router.refresh(); }
  });

  return (
    <div className="card p-5">
      <div className="h-card">Players can</div>

      <label className="mt-4 flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="block text-body font-bold text-on-surface">Browse your library</span>
          <span className="mt-0.5 block text-body-sm leading-snug text-on-surface-variant">
            {library ? 'Every program and drill, in their Library tab. They can run any of them.' : 'They see only what you set them.'}
          </span>
        </span>
        <input type="checkbox" role="switch" className="mt-1 h-5 w-5 shrink-0 accent-current" checked={library}
               onChange={(e) => setLibrary(e.target.checked)} />
      </label>

      <div className="mt-5">
        <div className="text-body font-bold text-on-surface">Add a session when they have time</div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Extra sessions a week">
          {[0, 1, 2, 3].map((n) => <Chip key={n} on={extras === n} onClick={() => setExtras(n)}>{n ? `${n} a week` : 'Off'}</Chip>)}
        </div>
        <p className="mt-2 text-body-sm leading-snug text-on-surface-variant">
          {extras
            ? 'Built from their focus and session length, with drills they haven’t done this week. Only once today’s session is done, and never on a game day.'
            : 'Players stick to the week you set.'}
        </p>
      </div>

      <label className="mt-5 flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="block text-body font-bold text-on-surface">Do Speed</span>
          <span className="mt-0.5 block text-body-sm leading-snug text-on-surface-variant">
            {speed
              ? 'A year of sprint, jump and strength sessions, in their Speed tab.'
              : 'No Speed tab. Anything they’ve done there is kept if you turn it back on.'}
          </span>
        </span>
        <input type="checkbox" role="switch" className="mt-1 h-5 w-5 shrink-0 accent-current" checked={speed}
               onChange={(e) => setSpeed(e.target.checked)} />
      </label>

      {dirty && (
        <button type="button" disabled={pending} onClick={save} className="btn-primary pressable mt-5 w-full">
          {pending ? 'Saving…' : 'Save'}
        </button>
      )}
      {err && <p role="alert" className="mt-3 text-body font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
