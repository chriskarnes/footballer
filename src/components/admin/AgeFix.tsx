'use client';
import { useState, useTransition } from 'react';
import { setAgeBand } from '@/app/admin/users/actions';
import { AGE_BANDS, isUnder13 } from '@/lib/child';
import { offline } from '@/lib/plain-error';
import { SettingRow } from './PlayerPay';

/**
 * A person's age, put right by an admin when it was picked by mistake (0044).
 * `consent` is where a parent's or guardian's agreement stands, for under 13.
 */
export function AgeFix({ id, band, label, consent }: { id: string; band: string | null; label: string; consent: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(band ?? '');
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const save = () => start(async () => {
    setMsg('');
    const r = await setAgeBand(id, value).catch(offline);
    if (r.ok) setEditing(false); else setMsg(r.error);
  });
  const leaving = isUnder13(band) && !!value && !isUnder13(value);
  return (
    <SettingRow label="Age" editing={editing} onEdit={() => setEditing(true)} value={label} note={consent ?? undefined}>
      <div className="max-w-xl">
        <div role="group" aria-label="Age" className="flex flex-wrap gap-2">
          {AGE_BANDS.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={value === v} onClick={() => setValue(v)}
                    className={`chip pressable ${value === v ? 'chip-on' : ''}`}>{l}</button>
          ))}
        </div>
        <p className="mt-4 text-body-sm leading-relaxed text-on-surface-variant">
          {leaving
            ? 'Only when you know they’re 13 or over (they or their trainer told you). Nobody is asked to agree any more, and the 30 days before deletion stop.'
            : 'For an age picked by mistake. Players can’t raise their own past 12 until a parent or guardian agrees.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={busy || !value || value === band} className="btn-primary btn-sm pressable" onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => { setValue(band ?? ''); setMsg(''); setEditing(false); }}>Cancel</button>
        </div>
        {msg && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{msg}</p>}
      </div>
    </SettingRow>
  );
}
