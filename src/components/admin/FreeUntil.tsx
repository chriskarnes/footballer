'use client';
import { useState, useTransition } from 'react';
import { setFreeUntil } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';

/** An academy's free time (0037): the day it ends, set or cleared. */
export function FreeUntil({ id, until }: { id: string; until: string | null }) {
  const [value, setValue] = useState(until ?? '');
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const save = (v: string | null) => start(async () => {
    setMsg('');
    const r = await setFreeUntil(id, v).catch(offline);
    setMsg(r.ok ? 'Saved.' : r.error);
    if (r.ok && !v) setValue('');
  });
  return (
    <div className="mt-4">
      <label className="text-field max-w-[16rem]">
        <span>Free until</span>
        <input type="date" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy || !value} className="btn-primary btn-sm pressable" onClick={() => save(value)}>{busy ? 'Saving…' : 'Save'}</button>
        {until && <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => save(null)}>Clear</button>}
      </div>
      <p className="mt-3 text-body-sm text-on-surface-variant">
        Used when the owner adds a card: they aren&rsquo;t charged until after this day. It doesn&rsquo;t change a card already added.
      </p>
      {msg && <p role="status" className="mt-2 text-body-sm font-semibold text-on-surface">{msg}</p>}
    </div>
  );
}
