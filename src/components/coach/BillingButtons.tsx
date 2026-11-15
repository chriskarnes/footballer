'use client';
import { useState, useTransition } from 'react';
import { openPortal, startCheckout } from '@/app/coach/billing/actions';
import { offline } from '@/lib/plain-error';

/**
 * The two ways out to Stripe: its checkout, to add a card, and its own page
 * for the card on file, invoices and cancelling. Both leave this site.
 */
export function BillingButtons({ action, hasCustomer }: { action: 'add' | 'manage'; hasCustomer: boolean }) {
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const go = (fn: typeof startCheckout) => start(async () => {
    setErr('');
    const r = await fn().catch(offline);
    if (r.ok) window.location.assign(r.url);
    else setErr(r.error);
  });
  return (
    <div className="mt-5">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {action === 'add'
          ? <button type="button" disabled={busy} className="btn-primary pressable" onClick={() => go(startCheckout)}>{busy ? 'Opening…' : 'Add a card'}</button>
          : <button type="button" disabled={busy} className="btn-primary pressable" onClick={() => go(openPortal)}>{busy ? 'Opening…' : 'Manage card and invoices'}</button>}
        {action === 'add' && hasCustomer && (
          <button type="button" disabled={busy} className="btn-ghost pressable" onClick={() => go(openPortal)}>Past invoices</button>
        )}
      </div>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
