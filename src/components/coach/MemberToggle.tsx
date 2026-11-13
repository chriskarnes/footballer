'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setMembership } from '@/app/coach/content-actions';
import { useToast } from './Toast';

/** One player's row in a group's roster: tap to put them in or take them out. */
export function MemberToggle({ groupId, userId, name, detail, initial }: {
  groupId: string; userId: string; name: string; detail?: string; initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  const [err, setErr] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const first = name.split(' ')[0];
  return (
    <button type="button" role="switch" aria-checked={on} disabled={busy}
            onClick={() => start(async () => {
              const next = !on; setOn(next); setErr(false);
              const r = await setMembership(groupId, userId, next);
              if (!r.ok) { setOn(!next); setErr(true); }
              // The list of who's in it, above, is the server's: bring it up to date.
              else { toast(next ? `${first} is in the group.` : `${first} is out of the group.`); router.refresh(); }
            })}
            className="flex w-full items-center gap-3 px-4 py-3 text-left">
      <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-small border-2 ${on ? 'border-on-surface bg-on-surface' : 'border-outline'}`}>
        {on && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-surface" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-lg font-semibold text-on-surface">{name}</span>
        {(detail || err) && <span className="block truncate text-body-sm text-on-surface-variant">{err ? 'Couldn’t save. Try again.' : detail}</span>}
      </span>
    </button>
  );
}
