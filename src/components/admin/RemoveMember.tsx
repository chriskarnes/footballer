'use client';
import { useState, useTransition } from 'react';
import { removeSelfServeMember } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';

/** Takes one player out of a self-serve space (0033). */
export function RemoveMember({ academyId, userId, name }: { academyId: string; userId: string; name: string }) {
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  return (
    <span className="relative z-10 inline-flex flex-col items-end">
      <button type="button" disabled={busy} aria-label={`Remove ${name}`}
              className="btn-ghost btn-sm pressable"
              onClick={() => {
                if (!confirm(`Remove ${name}? They lose the library here, and need the invite link to come back. Their training history stays theirs.`)) return;
                start(async () => {
                  setErr('');
                  const r = await removeSelfServeMember(academyId, userId).catch(offline);
                  if (!r.ok) setErr(r.error);
                });
              }}>
        {busy ? 'Removing…' : 'Remove'}
      </button>
      {err && <span role="alert" className="mt-1 text-body-sm font-semibold text-on-surface">{err}</span>}
    </span>
  );
}
