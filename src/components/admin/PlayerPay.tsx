'use client';
import { useState, useTransition } from 'react';
import { setPlayerPay } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';

/**
 * Who pays at an academy (0038): each player's family, by card, at a price
 * and after a number of free days set here; or the trainer (0037).
 */
export function PlayerPay({ id, on, priceCents, trialDays }: { id: string; on: boolean; priceCents: number; trialDays: number }) {
  const [price, setPrice] = useState(String(priceCents / 100));
  const [days, setDays] = useState(String(trialDays));
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const save = (next: boolean) => start(async () => {
    setMsg('');
    const r = await setPlayerPay(id, next, Number(price), Number(days)).catch(offline);
    setMsg(r.ok ? 'Saved.' : r.error);
  });
  return (
    <div className="card mt-4 p-5">
      <div className="h-card">{on ? 'Families pay' : 'Families don’t pay here'}</div>
      <p className="mt-1 text-body leading-relaxed text-on-surface-variant">
        {on
          ? 'Each player’s family pays by card after their free days, and the trainer pays nothing. A player who hasn’t paid can’t open their sessions.'
          : 'Turn this on and each player’s family pays by card after their free days. Players already here get their free days from the moment it’s turned on.'}
      </p>
      <div className="mt-4 grid max-w-[24rem] grid-cols-2 gap-3">
        <label className="text-field"><span>Price a month ($)</span>
          <input type="number" inputMode="decimal" min={1} max={1000} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="text-field"><span>Free days first</span>
          <input type="number" inputMode="numeric" min={0} max={365} value={days} onChange={(e) => setDays(e.target.value)} /></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {on
          ? <>
              <button type="button" disabled={busy} className="btn-primary btn-sm pressable" onClick={() => save(true)}>{busy ? 'Saving…' : 'Save price and days'}</button>
              <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => save(false)}>Turn off</button>
            </>
          : <button type="button" disabled={busy} className="btn-primary btn-sm pressable" onClick={() => save(true)}>{busy ? 'Saving…' : 'Turn on'}</button>}
      </div>
      <p className="mt-3 text-body-sm text-on-surface-variant">
        A new price is for families who add a card from now on; those already paying keep theirs. Turning it off doesn&rsquo;t cancel cards already on file: do that in Stripe.
      </p>
      {msg && <p role="status" className="mt-2 text-body-sm font-semibold text-on-surface">{msg}</p>}
    </div>
  );
}
