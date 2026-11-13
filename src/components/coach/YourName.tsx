'use client';
import { offline } from '@/lib/plain-error';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveName } from '@/app/coach/setup/actions';

/**
 * Asked once, on the dashboard, of a trainer with no name yet: players see
 * it on their sessions and notes, where an email address would otherwise go.
 */
export function YourName() {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();
  const save = () => start(async () => {
    setErr('');
    const r = await saveName(name).catch(offline);
    if (!r.ok) return setErr(r.error);
    router.refresh();
  });
  return (
    <form className="card mt-5 p-5 lg:max-w-xl" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="h-card">What do your players call you?</div>
      <p className="mt-0.5 text-body text-on-surface-variant">It goes on the sessions and notes you send them. Players see the first word, so a first name reads best.</p>
      <div className="mt-4 flex gap-2">
        <label className="text-field min-w-0 flex-1">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
                 placeholder="e.g. Sam" aria-label="Your name" autoComplete="name" />
        </label>
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary pressable shrink-0 px-5">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {err && <p role="alert" className="mt-3 text-body font-semibold text-on-surface">{err}</p>}
    </form>
  );
}
