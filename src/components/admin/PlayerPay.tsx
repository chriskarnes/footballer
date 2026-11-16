'use client';
import { useState, useTransition } from 'react';
import { setBilling } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';

type Mode = 'players_pay' | 'trainer_pays' | 'none';
const MODES: { id: Mode; name: string; what: string }[] = [
  { id: 'players_pay', name: 'Families pay', what: 'Each player’s family pays by card after their free days, and the trainer pays nothing. A player who hasn’t paid can’t open their sessions.' },
  { id: 'trainer_pays', name: 'The trainer pays', what: 'The owner pays $5 for each active player and charges their players however they like. Nothing is locked.' },
  { id: 'none', name: 'Nobody pays', what: 'For the demo and your own academies. No one is asked for a card.' },
];

/** Who pays at an academy (0038, 0040), with the families' price and free days. */
export function PlayerPay({ id, mode, priceCents, trialDays }: { id: string; mode: Mode; priceCents: number; trialDays: number }) {
  const [pick, setPick] = useState<Mode>(mode);
  const [price, setPrice] = useState(String(priceCents / 100));
  const [days, setDays] = useState(String(trialDays));
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const save = () => start(async () => {
    setMsg('');
    const r = await setBilling(id, pick, Number(price), Number(days)).catch(offline);
    setMsg(r.ok ? 'Saved.' : r.error);
  });
  return (
    <div className="card mt-4 p-5">
      <div className="h-card">Who pays</div>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label="Who pays">
        {MODES.map((m) => (
          <label key={m.id} className={`flex cursor-pointer gap-3 rounded-small border p-3 ${pick === m.id ? 'border-on-surface' : 'border-outline-variant'}`}>
            <input type="radio" name="billing-mode" className="mt-1" checked={pick === m.id} onChange={() => setPick(m.id)} />
            <span>
              <span className="block text-body font-semibold text-on-surface">{m.name}{mode === m.id ? ' · now' : ''}</span>
              <span className="mt-0.5 block text-body-sm leading-relaxed text-on-surface-variant">{m.what}</span>
            </span>
          </label>
        ))}
      </div>
      {pick === 'players_pay' && (
        <div className="mt-4 grid max-w-[24rem] grid-cols-2 gap-3">
          <label className="text-field"><span>Price a month ($)</span>
            <input type="number" inputMode="decimal" min={1} max={1000} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label className="text-field"><span>Free days first</span>
            <input type="number" inputMode="numeric" min={0} max={365} value={days} onChange={(e) => setDays(e.target.value)} /></label>
        </div>
      )}
      <button type="button" disabled={busy} className="btn-primary btn-sm pressable mt-4" onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      <p className="mt-3 text-body-sm text-on-surface-variant">
        Switching to families-pay starts every player&rsquo;s free days from now. A new price is for families who add a card from now on.
        Changing who pays doesn&rsquo;t cancel cards already on file: do that in Stripe.
      </p>
      {msg && <p role="status" className="mt-2 text-body-sm font-semibold text-on-surface">{msg}</p>}
    </div>
  );
}
