'use client';
import { useState, useTransition } from 'react';
import { setFreeUntil } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';
import { SettingRow } from './PlayerPay';

const longDay = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`)
  .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** An academy's free time (0037): the day it ends, set or cleared. `status` is where the owner's card stands. */
export function FreeUntil({ id, until, status }: { id: string; until: string | null; status: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(until?.slice(0, 10) ?? '');
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const save = (v: string | null) => start(async () => {
    setMsg('');
    const r = await setFreeUntil(id, v).catch(offline);
    if (r.ok) { if (!v) setValue(''); setEditing(false); } else setMsg(r.error);
  });
  return (
    <SettingRow label="Trainer’s card" editing={editing} onEdit={() => setEditing(true)}
      value={status} note={until ? `Free until ${longDay(until)}` : 'No free time set'}>
      <div className="max-w-xl">
        <label className="text-field max-w-[16rem]">
          <span>Free until</span>
          <input type="date" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <p className="mt-4 text-body-sm leading-relaxed text-on-surface-variant">
          Used when the owner adds a card: they aren&rsquo;t charged until after this day. It doesn&rsquo;t change a card already added.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={busy || !value} className="btn-primary btn-sm pressable" onClick={() => save(value)}>{busy ? 'Saving…' : 'Save'}</button>
          {until && <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => save(null)}>Clear free time</button>}
          <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => { setValue(until?.slice(0, 10) ?? ''); setMsg(''); setEditing(false); }}>Cancel</button>
        </div>
        {msg && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{msg}</p>}
      </div>
    </SettingRow>
  );
}
