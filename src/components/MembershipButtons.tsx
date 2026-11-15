'use client';
import { useState, useTransition } from 'react';
import { openMembershipPortal, startMembership } from '@/app/membership/actions';
import { offline } from '@/lib/plain-error';

/**
 * A family's two ways out to Stripe (0038): its checkout, to add a card, and
 * its own page for the card on file, receipts and cancelling.
 */
export function MembershipButtons({ action, hasCustomer = false, label }: { action: 'add' | 'manage'; hasCustomer?: boolean; label?: string }) {
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const go = (fn: typeof startMembership) => start(async () => {
    setErr('');
    const r = await fn().catch(offline);
    if (r.ok) window.location.assign(r.url);
    else setErr(r.error);
  });
  return (
    <div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {action === 'add'
          ? <button type="button" disabled={busy} className="btn-primary pressable" onClick={() => go(startMembership)}>{busy ? 'Opening…' : label ?? 'Add a card'}</button>
          : <button type="button" disabled={busy} className="btn-primary pressable" onClick={() => go(openMembershipPortal)}>{busy ? 'Opening…' : label ?? 'Manage card or cancel'}</button>}
        {action === 'add' && hasCustomer && (
          <button type="button" disabled={busy} className="btn-ghost pressable" onClick={() => go(openMembershipPortal)}>Past receipts</button>
        )}
      </div>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
