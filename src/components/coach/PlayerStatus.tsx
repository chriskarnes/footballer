'use client';
import { useState, useTransition } from 'react';
import { setPlayerActive, setPlayerPaid } from '@/app/coach/actions';
import { offline } from '@/lib/plain-error';

/**
 * One player's standing, for their trainer (0040): on or off, and where
 * payment stands. Where families pay, that's Stripe's word and can't be
 * changed here. Where the trainer collects their own way, it's the trainer's
 * own note, ticked by hand.
 */
export function PlayerStatus({ userId, first, active, mode, paid, paidOn, line, label }: {
  userId: string; first: string; active: boolean;
  mode: 'trainer_pays' | 'players_pay' | 'none';
  paid: boolean; paidOn: string | null;
  /** Where a family's payments stand, in a sentence. */
  line: string | null;
  label: string;
}) {
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => start(async () => {
    setErr('');
    const r = await fn().catch(offline);
    if (!r.ok) setErr(r.error);
  });
  return (
    <section className="card mt-9 p-5 xl:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-card">{active ? 'Active' : 'Inactive'}</div>
        {label && active && <div className="text-body font-semibold text-on-surface-variant">{label}</div>}
      </div>
      <p className="mt-1 text-body leading-snug text-on-surface-variant">
        {active
          ? line ?? (mode === 'trainer_pays' ? `${first} counts toward what you pay.` : `${first} can open their training.`)
          : `${first} is still on your list with their history, but can’t open their training. ${mode === 'players_pay' ? 'Their family isn’t being charged.' : mode === 'trainer_pays' ? 'You aren’t charged for them.' : ''}`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={`${active ? 'btn-ghost' : 'btn-primary'} btn-sm pressable`}
                onClick={() => run(() => setPlayerActive(userId, !active))}>
          {busy ? 'Saving…' : active ? 'Make inactive' : 'Make active'}
        </button>
        {mode === 'trainer_pays' && active && (
          <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => run(() => setPlayerPaid(userId, !paid))}>
            {paid ? 'Mark as not paid' : 'Mark as paid'}
          </button>
        )}
      </div>
      {mode === 'trainer_pays' && active && (
        <p className="mt-3 text-body-sm text-on-surface-variant">
          {paid ? `Marked as paid${paidOn ? ` on ${paidOn}` : ''}. ` : ''}“Paid” is your own note of who has paid you. It doesn’t change what {first} can open.
        </p>
      )}
      {mode === 'players_pay' && !active && (
        <p className="mt-3 text-body-sm text-on-surface-variant">Made active again, their family adds their card again to carry on.</p>
      )}
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    </section>
  );
}
