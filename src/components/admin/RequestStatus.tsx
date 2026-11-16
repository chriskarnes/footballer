'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setRequestStatus } from '@/app/admin/requests/actions';
import { offline } from '@/lib/plain-error';
import { Menu } from './Menu';

/** Contacted, declined, or back to new, from the request's menu: so the open count means what's left to do. */
export function RequestStatus({ id, status, name }: { id: string; status: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const go = async (to: 'new' | 'contacted' | 'declined') => {
    setBusy(true); setErr('');
    const r = await setRequestStatus(id, to).catch(offline);
    setBusy(false);
    if (r.ok) router.refresh(); else setErr(r.error);
  };
  return (
    <>
      <Menu label={`Options for ${name}`} busy={busy} items={[
        ...(status === 'new' ? [{ label: 'Mark as contacted', onSelect: () => go('contacted') }] : []),
        ...(status !== 'new' ? [{ label: 'Move back to new', onSelect: () => go('new') }] : []),
        ...(status !== 'declined' ? [{ label: 'Decline', danger: true, onSelect: () => go('declined') }] : []),
      ]} />
      {err && <span role="alert" className="text-body-sm font-semibold text-on-surface">{err}</span>}
    </>
  );
}
