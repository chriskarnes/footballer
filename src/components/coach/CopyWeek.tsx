'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { copyWeek } from '@/app/coach/content-actions';

/** Week n's sessions into week n+1, as the start of a progression. */
export function CopyWeek({ programId, from, to }: { programId: string; from: number; to: number }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  const router = useRouter();
  return (
    <>
      <button type="button" disabled={busy} className="btn-ghost btn-sm pressable"
              onClick={() => start(async () => {
                const r = await copyWeek(programId, from, to);
                if (r.ok) router.refresh(); else setErr(r.error);
              })}>
        {busy ? 'Copying…' : `Copy to week ${to}`}
      </button>
      {err && <p role="alert" className="w-full text-[12.5px] font-semibold">{err}</p>}
    </>
  );
}
