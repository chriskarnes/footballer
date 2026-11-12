'use client';
import { useState, useTransition } from 'react';
import { addMySession } from '@/app/train/actions';
import { haptic } from '@/lib/haptics';

/**
 * One more session, when their trainer allows it: a single button. When it
 * can't be pressed, the reason is the line under it. `inBand` is the big
 * "Bonus session" in Train's band once the week is done.
 */
export function AddSession({ why, inBand = false }: { why: string | null; inBand?: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <div className="mt-4">
      <button type="button" disabled={pending || !!why}
              className={inBand ? 'btn-primary btn-big pressable w-full bg-on-surface-brand text-surface-brand disabled:opacity-50'
                : 'btn-ghost pressable min-h-[52px] w-full text-[15px] font-bold disabled:opacity-50'}
              onClick={() => start(async () => { haptic('tap'); setErr(''); const r = await addMySession(); if (r && !r.ok) setErr(r.error); })}>
        {pending ? 'Building…' : inBand ? 'Bonus session' : '+ Add an extra session'}
      </button>
      {(err || why) && (
        <p className={`mt-2 text-center text-[13.5px] font-medium ${inBand ? 'text-on-surface-brand-variant' : 'text-on-surface-variant'}`}>{err || why}</p>
      )}
    </div>
  );
}
