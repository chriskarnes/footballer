'use client';
import { useState } from 'react';
import { useToast } from '@/components/coach/Toast';
import { useRouter } from 'next/navigation';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { removeMember } from '@/app/coach/actions';

/** At the very bottom, behind a confirmation: it's rare and it's final. */
export function RemovePlayer({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="mt-9 border-t border-outline-variant pt-4">
      <button type="button" onClick={() => setOpen(true)}
              className="text-body font-semibold text-on-surface-variant underline underline-offset-4">
        Remove {name} from the academy
      </button>
      {err && <p role="alert" className="mt-2 text-body-sm font-semibold text-on-surface">{err}</p>}
      <ConfirmSheet open={open} busy={busy} title={`Remove ${name}?`} confirmLabel="Remove"
        body={`${name} leaves your list and stops getting notes. Their own training history stays with their account.`}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          const r = await removeMember(userId);
          setBusy(false); setOpen(false);
          if (r.ok) { toast(`${name} removed.`); router.push('/coach'); } else setErr(r.error);
        }} />
    </div>
  );
}
