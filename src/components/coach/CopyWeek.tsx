'use client';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/coach/Toast';
import { useRouter } from 'next/navigation';
import { copyWeek } from '@/app/coach/content-actions';

/** Week n's sessions into week n+1, as the start of a progression. */
export function CopyWeek({ programId, from, to }: { programId: string; from: number; to: number }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button type="button" disabled={busy} className="btn-ghost btn-sm pressable"
              onClick={() => start(async () => {
                const r = await copyWeek(programId, from, to);
                if (r.ok) { toast(`Copied to week ${to}.`); router.refresh(); } else setErr(r.error);
              })}>
        {busy ? 'Copying…' : `Copy to week ${to}`}
      </button>
      {err && <p role="alert" className="w-full text-body-sm font-semibold">{err}</p>}
    </>
  );
}
