'use client';
import { useState, useTransition } from 'react';
import { joinAcademy } from '@/app/join/actions';

export function JoinButton({ code, label, email }: { code: string; label: string; email: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <div>
      <button type="button" disabled={pending} className="btn-primary pressable w-full"
              onClick={() => start(async () => { const r = await joinAcademy(code); if (r && !r.ok) setErr(r.error); })}>
        {pending ? 'Joining…' : label}
      </button>
      <p className="mt-3 text-[12.5px] text-on-surface-variant">Signed in as {email}.</p>
      {err && <p role="status" className="mt-2 text-[13px] font-semibold text-on-surface">Couldn&rsquo;t join: {err}</p>}
    </div>
  );
}
