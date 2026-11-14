'use client';
import { useState, useTransition } from 'react';
import { joinSelfServe } from '@/app/join/actions';
import { offline } from '@/lib/plain-error';

/** One tap into an open self-serve space (0030). */
export function StartOnYourOwn() {
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  return (
    <div>
      <button type="button" disabled={busy} className="btn-primary pressable w-full"
              onClick={() => start(async () => {
                const r = await joinSelfServe().catch(offline);
                if (r && !r.ok) setErr(r.error);
              })}>
        {busy ? 'Starting…' : 'Start training'}
      </button>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
