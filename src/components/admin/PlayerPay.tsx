'use client';
import { useState, useTransition } from 'react';
import { setBilling } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';
import { ICON } from './ui';

type Mode = 'players_pay' | 'trainer_pays' | 'none';
const MODES: { id: Mode; name: string; what: string }[] = [
  { id: 'players_pay', name: 'Families pay', what: 'Each family pays by card after their free days. The trainer pays nothing.' },
  { id: 'trainer_pays', name: 'The trainer pays', what: '$5 for each active player. Nothing is locked.' },
  { id: 'none', name: 'Nobody pays', what: 'For the demo and your own academies.' },
];

/** A setting on one line, with a pencil that opens it. Shared with FreeUntil. */
export function SettingRow({ label, value, note, editing, onEdit, children }: {
  label: string; value: React.ReactNode; note?: React.ReactNode; editing: boolean; onEdit: () => void; children: React.ReactNode;
}) {
  return (
    <div className="py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 sm:flex sm:items-baseline sm:gap-6">
          <p className="w-36 shrink-0 text-body-sm font-semibold text-on-surface-variant">{label}</p>
          <div>
            <p className="text-body font-semibold text-on-surface">{value}</p>
            {note && <p className="mt-0.5 text-body-sm text-on-surface-variant">{note}</p>}
          </div>
        </div>
        {!editing && (
          <button type="button" aria-label={`Change: ${label}`} title="Change" className="icon-btn bg-transparent text-on-surface-variant hover:text-on-surface" onClick={onEdit}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON.edit} /></svg>
          </button>
        )}
      </div>
      {editing && <div className="mt-5 sm:pl-42">{children}</div>}
    </div>
  );
}

/** Who pays at an academy (0038, 0040), with the families' price and free days. */
export function PlayerPay({ id, mode, priceCents, trialDays }: { id: string; mode: Mode; priceCents: number; trialDays: number }) {
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState<Mode>(mode);
  const [price, setPrice] = useState(String(priceCents / 100));
  const [days, setDays] = useState(String(trialDays));
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const save = () => start(async () => {
    setMsg('');
    const r = await setBilling(id, pick, Number(price), Number(days)).catch(offline);
    if (r.ok) setEditing(false); else setMsg(r.error);
  });
  const cancel = () => { setPick(mode); setPrice(String(priceCents / 100)); setDays(String(trialDays)); setMsg(''); setEditing(false); };
  const now = MODES.find((m) => m.id === mode)!;
  const dollars = `$${(priceCents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  return (
    <SettingRow label="Who pays" editing={editing} onEdit={() => setEditing(true)}
      value={now.name}
      note={mode === 'players_pay' ? `${dollars} a month, after ${trialDays} free ${trialDays === 1 ? 'day' : 'days'}` : mode === 'trainer_pays' ? '$5 a month for each active player' : 'No one is asked for a card'}>
      <div className="max-w-xl">
        <div className="space-y-2" role="radiogroup" aria-label="Who pays">
          {MODES.map((m) => (
            <label key={m.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${pick === m.id ? 'border-on-surface' : 'border-outline-variant'}`}>
              <input type="radio" name="billing-mode" className="mt-1" checked={pick === m.id} onChange={() => setPick(m.id)} />
              <span>
                <span className="block text-body font-semibold text-on-surface">{m.name}</span>
                <span className="mt-0.5 block text-body-sm leading-relaxed text-on-surface-variant">{m.what}</span>
              </span>
            </label>
          ))}
        </div>
        {pick === 'players_pay' && (
          <div className="mt-5 grid max-w-[24rem] grid-cols-2 gap-3">
            <label className="text-field"><span>Price a month ($)</span>
              <input type="number" inputMode="decimal" min={1} max={1000} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
            <label className="text-field"><span>Free days first</span>
              <input type="number" inputMode="numeric" min={0} max={365} value={days} onChange={(e) => setDays(e.target.value)} /></label>
          </div>
        )}
        <p className="mt-5 text-body-sm leading-relaxed text-on-surface-variant">
          Switching to families-pay starts every player&rsquo;s free days from now. A new price is for families who add a card from now on.
          Changing who pays doesn&rsquo;t cancel cards already on file: do that in Stripe.
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" disabled={busy} className="btn-primary btn-sm pressable" onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={cancel}>Cancel</button>
        </div>
        {msg && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{msg}</p>}
      </div>
    </SettingRow>
  );
}
