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
              className={inBand ? 'btn-primary btn-on-brand btn-big pressable w-full'
                : 'btn-ghost pressable min-h-[52px] w-full text-body-lg font-bold disabled:opacity-50'}
              onClick={() => start(async () => { haptic('tap'); setErr(''); const r = await addMySession(); if (r && !r.ok) setErr(r.error); })}>
        {pending ? 'Building…' : inBand ? 'Extra session' : '+ Extra session'}
      </button>
      {(err || why) && (
        <p className={`mt-2 text-center text-body font-medium ${inBand ? 'text-on-surface-brand-variant' : 'text-on-surface-variant'}`}>{err || why}</p>
      )}
    </div>
  );
}
