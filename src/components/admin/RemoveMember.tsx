'use client';
import { useState, useTransition } from 'react';
import { removeSelfServeMember } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Menu } from './Menu';

/** Takes one player out of a self-serve space (0033), from the menu on their row. */
export function RemoveMember({ academyId, userId, name }: { academyId: string; userId: string; name: string }) {
  const [err, setErr] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-end">
      <Menu label={`Options for ${name}`} busy={busy} items={[{ label: 'Remove from this space', danger: true, onSelect: () => setAsking(true) }]} />
      {err && <span role="alert" className="relative z-10 mt-1 text-body-sm font-semibold text-on-surface">{err}</span>}
      <ConfirmSheet open={asking} busy={busy} title={`Remove ${name}?`} confirmLabel="Remove"
        body="They lose the library here. The invite link is replaced, so the one they have stops working; if this space is open to all, close it first or they can tap back in. Their training history stays theirs."
        onCancel={() => setAsking(false)}
        onConfirm={() => start(async () => {
          setErr('');
          const r = await removeSelfServeMember(academyId, userId).catch(offline);
          setAsking(false);
          if (!r.ok) setErr(r.error);
        })} />
    </span>
  );
}
