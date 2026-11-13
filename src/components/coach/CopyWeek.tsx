'use client';
import { offline } from '@/lib/plain-error';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/coach/Toast';
import { useRouter } from 'next/navigation';
import { copyWeek } from '@/app/coach/content-actions';
import { ConfirmSheet } from '@/components/ConfirmSheet';

/**
 * Week n's sessions into week n+1, as the start of a progression. With
 * `label`, it's "Change week n" on a week that only repeats an earlier one:
 * the repeated sessions are copied in first, so changing it starts from what
 * the players were getting, not from an empty week that drops the rest.
 * `onNow` names who is on that week today: they're asked about first, since
 * the sessions they've done this week stop counting as done.
 */
export function CopyWeek({ programId, from, to, label, onNow = [] }: { programId: string; from: number; to: number; label?: string; onNow?: string[] }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  const router = useRouter();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const go = () => start(async () => {
    setErr('');
    const r = await copyWeek(programId, from, to).catch(offline);
    setAsking(false);
    if (r.ok) { toast(label ? `Week ${to} is its own now. Change it below.` : `Copied to week ${to}.`); router.refresh(); }
    else setErr(r.error);
  });
  return (
    <>
      <button type="button" disabled={busy} className="btn-ghost btn-sm pressable"
              onClick={() => (onNow.length ? setAsking(true) : go())}>
        {busy ? 'Copying…' : label ?? `Copy to week ${to}`}
      </button>
      {err && <p role="alert" className="w-full text-body-sm font-semibold">{err}</p>}
      <ConfirmSheet open={asking} busy={busy} title={`${label ?? `Copy to week ${to}`}?`} confirmLabel="Change it"
        body={`${onNow.join(', ')} ${onNow.length === 1 && !/players on their own$/.test(onNow[0]) ? 'is' : 'are'} on week ${to} now. Sessions done this week will show as not done.`}
        onCancel={() => setAsking(false)} onConfirm={go} />
    </>
  );
}
