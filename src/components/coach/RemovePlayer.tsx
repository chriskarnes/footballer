'use client';
import { offline } from '@/lib/plain-error';
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
        body={`${name} leaves your list and stops getting notes. Their plan settings and the weeks still to come are cleared; what they've done stays in their history.`}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          const r = await removeMember(userId).catch(offline);
          setBusy(false); setOpen(false);
          if (r.ok) { toast(`${name} removed.`); router.push('/coach'); } else setErr(r.error);
        }} />
    </div>
  );
}

/** The owner's way to take a trainer out: they stop seeing every player at once. */
export function RemoveTrainer({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
              className="min-h-11 shrink-0 px-2 text-body-sm font-semibold text-on-surface-variant underline underline-offset-4">
        Remove<span className="sr-only"> {name}</span>
      </button>
      {err && <p role="alert" className="text-body-sm font-semibold text-on-surface">{err}</p>}
      <ConfirmSheet open={open} busy={busy} title={`Remove ${name}?`} confirmLabel="Remove"
        body={`${name} stops being a trainer here and can't see your players or their notes any more. To come back, they'd need the trainer link and your yes.`}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          const r = await removeMember(userId).catch(offline);
          setBusy(false); setOpen(false);
          if (r.ok) { toast(`${name} removed.`); router.refresh(); } else setErr(r.error);
        }} />
    </>
  );
}
