'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeMember, setPlayerActive, setPlayerPaid } from '@/app/coach/actions';
import { offline } from '@/lib/plain-error';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Menu, type MenuItem } from '@/components/admin/Menu';
import { useToast } from './Toast';

type Ask = 'off' | 'remove' | null;

/**
 * What's done to a player rarely, behind the three dots beside their name:
 * switching them off or on (0040), noting they've paid (where the trainer
 * collects their own way), and removing them. Each of the two that take
 * something away asks first.
 */
export function PlayerMenu({ userId, first, active, mode, paid }: {
  userId: string; first: string; active: boolean;
  mode: 'trainer_pays' | 'players_pay' | 'none' | null; paid: boolean;
}) {
  const [ask, setAsk] = useState<Ask>(null);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, said: string, then?: () => void) => start(async () => {
    setErr('');
    const r = await fn().catch(offline);
    setAsk(null);
    if (!r.ok) { setErr(r.error); return; }
    toast(said);
    if (then) then(); else router.refresh();
  });

  const items: MenuItem[] = [
    ...(mode === null ? [] : active
      ? [{ label: 'Make inactive', onSelect: () => setAsk('off') }]
      : [{ label: 'Make active', onSelect: () => run(() => setPlayerActive(userId, true), `${first} is active again.`) }]),
    ...(mode === 'trainer_pays' && active
      ? [{ label: paid ? 'Mark as not paid' : 'Mark as paid', onSelect: () => run(() => setPlayerPaid(userId, !paid), paid ? 'Marked as not paid.' : 'Marked as paid.') }] : []),
    { label: `Remove ${first}`, danger: true, onSelect: () => setAsk('remove') },
  ];

  return (
    <>
      <Menu label={`Options for ${first}`} items={items} busy={busy} />
      {err && <p role="alert" className="basis-full text-body-sm font-semibold text-on-surface">{err}</p>}
      <ConfirmSheet open={ask === 'off'} busy={busy} title={`Make ${first} inactive?`} confirmLabel="Make inactive"
        body={`${first} stays on your list with their history, but can’t open their training. ${mode === 'players_pay' ? 'Their family’s payments stop, and they add their card again if you switch them back on.' : mode === 'trainer_pays' ? 'You aren’t charged for them.' : ''}`}
        onCancel={() => setAsk(null)}
        onConfirm={() => run(() => setPlayerActive(userId, false), `${first} is inactive.`)} />
      <ConfirmSheet open={ask === 'remove'} busy={busy} title={`Remove ${first}?`} confirmLabel="Remove"
        body={`${first} leaves your list and stops getting notes. Their plan settings and the weeks still to come are cleared; what they've done stays in their history.`}
        onCancel={() => setAsk(null)}
        onConfirm={() => run(() => removeMember(userId), `${first} removed.`, () => router.push('/coach'))} />
    </>
  );
}
