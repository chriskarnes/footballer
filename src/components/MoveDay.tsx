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
  const router = useRouter();

  const change = (to: number) => {
    const was = day;
    setDay(to);
    start(async () => {
      const r = await moveItem({ key: itemKey, weekday: to, placed });
      if (!r.ok) { setDay(was); alertless(r.error); return; }
      router.refresh();
    });
  };

  return (
    <label className={`relative shrink-0 ${pending ? 'opacity-60' : ''}`}>
      <span className="sr-only">Day for {title}</span>
      <select value={day} onChange={(e) => change(Number(e.target.value))} disabled={pending}
              className="h-9 appearance-none rounded-full border border-outline bg-transparent pl-3 pr-7 text-[12.5px] font-bold text-on-surface">
        {DAYS.map((d, i) => <option key={d} value={i}>{d}{i === placed && day !== placed ? ' (usual)' : ''}</option>)}
      </select>
      <svg viewBox="0 0 12 8" className="pointer-events-none absolute right-3 top-1/2 h-2 w-2.5 -translate-y-1/2 text-on-surface-variant" aria-hidden="true">
        <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

// A failed move snaps back; the reason goes to the console rather than an
// alert, which would block the page.
function alertless(msg: string) { console.warn(`Couldn't move: ${msg}`); }
