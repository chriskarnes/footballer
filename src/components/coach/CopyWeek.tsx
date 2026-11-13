'use client';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/coach/Toast';
import { useRouter } from 'next/navigation';
import { copyWeek } from '@/app/coach/content-actions';

/**
 * Week n's sessions into week n+1, as the start of a progression. With
 * `label`, it's "Change week n" on a week that only repeats an earlier one:
 * the repeated sessions are copied in first, so changing it starts from what
 * the players were getting, not from an empty week that drops the rest.
 */
export function CopyWeek({ programId, from, to, label }: { programId: string; from: number; to: number; label?: string }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button type="button" disabled={busy} className="btn-ghost btn-sm pressable"
              onClick={() => start(async () => {
                const r = await copyWeek(programId, from, to);
                if (r.ok) { toast(label ? `Week ${to} is its own now. Change it below.` : `Copied to week ${to}.`); router.refresh(); }
                else setErr(r.error);
              })}>
        {busy ? 'Copying…' : label ?? `Copy to week ${to}`}
      </button>
      {err && <p role="alert" className="w-full text-body-sm font-semibold">{err}</p>}
    </>
  );
}
