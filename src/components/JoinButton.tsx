'use client';
import { useState, useTransition } from 'react';
import { joinAcademy } from '@/app/join/actions';

/** The last step for someone already signed in: one card, one button. */
export function JoinButton({ code, label, email, who }: { code: string; label: string; email: string; who?: 'player' | 'parent' }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <div className="card p-5">
      <div className="h-card">{label}</div>
      <p className="mt-1 text-body text-on-surface-variant">Signed in as {email}.</p>
      <button type="button" disabled={pending} className="btn-primary pressable mt-4 w-full"
              onClick={() => start(async () => { const r = await joinAcademy(code, who); if (r && !r.ok) setErr(r.error); })}>
        {pending ? 'Joining…' : 'Join'}
      </button>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
