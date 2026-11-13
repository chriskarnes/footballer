'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveGroup } from '@/app/coach/content-actions';
import { ConfirmSheet } from '@/components/ConfirmSheet';

/**
 * Finish a group (its players keep their history; the homework stops) or
 * bring it back. Finishing stops every member's sessions at once, so it asks
 * first; bringing one back doesn't.
 */
export function ArchiveGroup({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const [busy, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();

  const go = () => start(async () => {
    setErr('');
    const r = await archiveGroup(id, !archived);
    if (!r.ok) { setErr(r.error); setAsking(false); return; }
    setAsking(false);
    router.push(archived ? `/coach/groups/${id}` : '/coach/groups');
    router.refresh();
  });

  return (
    <>
      <button type="button" disabled={busy}
              className="mt-6 min-h-11 w-full text-center text-body font-semibold text-on-surface-variant underline underline-offset-4"
              onClick={() => (archived ? go() : setAsking(true))}>
        {archived ? 'Bring this group back' : 'Finish this group'}
      </button>
      {err && <p role="alert" className="mt-2 text-center text-body font-semibold text-on-surface">{err}</p>}
      <ConfirmSheet open={asking} busy={busy}
                    title={`Finish ${name}?`}
                    body="Its players stop getting the group’s sessions. Their history stays, and you can bring the group back."
                    confirmLabel="Finish group"
                    onConfirm={go} onCancel={() => setAsking(false)} />
    </>
  );
}
