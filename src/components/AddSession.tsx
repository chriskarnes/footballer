'use client';
import { useState, useTransition } from 'react';
import { addMySession } from '@/app/train/actions';
import { haptic } from '@/lib/haptics';

/**
 * "Got time? Add a session": one more, built from their own settings, when
 * their trainer allows it. Says why not, when not now.
 */
export function AddSession({ left, why }: { left: number; why: string | null }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <div className="card-flat mt-4 flex items-center justify-between gap-4 px-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-[14.5px] font-bold text-on-surface">Got time for more?</span>
        <span className="block text-[12.5px] leading-snug text-on-surface-variant">
          {err || why || `Add a session from your trainer’s drills. ${left} left this week.`}
        </span>
      </span>
      <button type="button" disabled={pending || !!why} className="btn-primary btn-sm pressable shrink-0"
              onClick={() => start(async () => { haptic('tap'); setErr(''); const r = await addMySession(); if (r && !r.ok) setErr(r.error); })}>
        {pending ? 'Building…' : 'Add one'}
      </button>
    </div>
  );
}
