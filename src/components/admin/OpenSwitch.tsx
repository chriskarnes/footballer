'use client';
import { useState, useTransition } from 'react';
import { setSelfServeOpen } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';

/** Open or close a self-serve space (0030). */
export function OpenSwitch({ id, slug, open, licensed }: { id: string; slug: string; open: boolean; licensed: boolean }) {
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  return (
    <div className="card mt-6 p-5">
      <div className="h-card">{open ? 'Open to everyone' : 'Invite only'}</div>
      <p className="mt-1 text-body leading-relaxed text-on-surface-variant">
        {open
          ? 'Anyone signed in can start with one tap, and the main site’s players page links here.'
          : licensed
            ? 'Players join with its invite link. It can’t open while it has the Forge library, which is for private use. Opening it takes your own drills in its library and the Forge library switched off; both are done in the database for now.'
            : 'Players join with its invite link. Open it and anyone can start with one tap, and the main site links here. Check its library has sessions in it first: Train is built from them.'}
      </p>
      {!(licensed && !open) && <button type="button" disabled={busy} className={`${open ? 'btn-ghost' : 'btn-primary'} btn-sm pressable mt-4`}
              onClick={() => start(async () => {
                setErr('');
                const r = await setSelfServeOpen(id, slug, !open).catch(offline);
                if (!r.ok) setErr(r.error);
              })}>
        {busy ? 'Saving…' : open ? 'Close it' : 'Open it to everyone'}
      </button>}
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
