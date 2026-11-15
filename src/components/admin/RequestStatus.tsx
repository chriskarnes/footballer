'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setRequestStatus } from '@/app/admin/requests/actions';
import { offline } from '@/lib/plain-error';

/** Contacted, declined, or back to new: so the open count means what's left to do. */
export function RequestStatus({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const go = async (to: 'new' | 'contacted' | 'declined') => {
    setBusy(true); setErr('');
    const r = await setRequestStatus(id, to).catch(offline);
    setBusy(false);
    if (r.ok) router.refresh(); else setErr(r.error);
  };
  const link = 'min-h-11 px-1 text-body-sm font-semibold text-on-surface-variant underline underline-offset-4 disabled:opacity-60';
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4">
      {status === 'new' && <button type="button" disabled={busy} className={link} onClick={() => go('contacted')}>Mark contacted</button>}
      {status !== 'declined' && <button type="button" disabled={busy} className={link} onClick={() => go('declined')}>Decline</button>}
      {status !== 'new' && <button type="button" disabled={busy} className={link} onClick={() => go('new')}>Back to new</button>}
      {err && <p role="alert" className="w-full text-body-sm font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
