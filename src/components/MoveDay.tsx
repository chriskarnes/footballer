'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moveItem } from '@/app/schedule-actions';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * "Can't do Wednesday": the item's day as a picker. A native select, so a
 * phone gives its own wheel. It moves this week only; picking the day the
 * app chose puts it back.
 */
export function MoveDay({ itemKey, weekday, placed, title }: { itemKey: string; weekday: number; placed: number; title: string }) {
  const [day, setDay] = useState(weekday);
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const router = useRouter();

  const change = (to: number) => {
    const was = day;
    setDay(to); setErr('');
    start(async () => {
      const r = await moveItem({ key: itemKey, weekday: to, placed });
      // A failed move snaps back, and says so under the picker.
      if (!r.ok) { setDay(was); setErr(r.error); return; }
      router.refresh();
    });
  };

  return (
    <span className="flex shrink-0 flex-col items-end">
    <label className={`relative ${pending ? 'opacity-60' : ''}`}>
      <span className="sr-only">Day for {title}</span>
      <select value={day} onChange={(e) => change(Number(e.target.value))} disabled={pending}
              className="h-11 appearance-none rounded-full border border-outline bg-transparent pl-3 pr-7 text-body-sm font-bold text-on-surface">
        {DAYS.map((d, i) => <option key={d} value={i}>{d}{i === placed && day !== placed ? ' (usual)' : ''}</option>)}
      </select>
      <svg viewBox="0 0 12 8" className="pointer-events-none absolute right-3 top-1/2 h-2 w-2.5 -translate-y-1/2 text-on-surface-variant" aria-hidden="true">
        <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
    {err && <span role="alert" className="mt-1 max-w-[14rem] text-right text-caption font-semibold text-on-surface">{err}</span>}
    </span>
  );
}
