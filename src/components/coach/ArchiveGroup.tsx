'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveGroup } from '@/app/coach/content-actions';

/** Finish a group (its players keep their history; the homework stops) or bring it back. */
export function ArchiveGroup({ id, archived }: { id: string; archived: boolean }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" disabled={busy}
            className="mt-6 w-full text-center text-[13px] font-semibold text-on-surface-variant underline underline-offset-4"
            onClick={() => start(async () => { await archiveGroup(id, !archived); router.push(archived ? `/coach/groups/${id}` : '/coach/groups'); router.refresh(); })}>
      {archived ? 'Bring this group back' : 'Finish this group'}
    </button>
  );
}
