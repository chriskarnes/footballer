'use client';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { saveSession, deleteSession } from '@/app/coach/content-actions';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import type { DrillRow } from '@/lib/academy-week';
import { Field, FormError } from './Field';

/**
 * A session: a name and drills in order. Tap a drill to add it, use the
 * arrows to reorder. The total time is the sum of the drills.
 */
export function SessionEditor({ programId, week, session, drills, newDrillHref }: {
  programId: string; week: number;
  session?: { id: string; name: string; drill_ids: string[] };
  drills: DrillRow[]; newDrillHref: string;
}) {
  const [name, setName] = useState(session?.name ?? '');
  const [ids, setIds] = useState<string[]>(session?.drill_ids ?? []);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const byId = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills]);
  const minutes = ids.reduce((a, id) => a + (byId.get(id)?.minutes ?? 0), 0);
  const shown = drills.filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()));

  const move = (i: number, by: number) => setIds((xs) => {
    const j = i + by; if (j < 0 || j >= xs.length) return xs;
    const next = [...xs]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });

  return (
    <div className="space-y-6">
      <Field label="Session name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Wall work" /></Field>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="eyebrow">In this session</p>
          <span className="text-[13px] text-on-surface-variant">{ids.length} drills · {minutes} min</span>
        </div>
        {ids.length ? (
          <ol className="card divide-y divide-outline-variant">
            {ids.map((id, i) => {
              const d = byId.get(id);
              return (
                <li key={`${id}-${i}`} className="flex items-center gap-2 py-2.5 pl-4 pr-2">
                  <span className="w-5 shrink-0 text-[13px] font-bold text-on-surface-variant">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-on-surface">{d?.name ?? 'Deleted drill'}</span>
                    {d && <span className="block truncate text-[12.5px] text-on-surface-variant">{[d.amount, `${d.minutes} min`].filter(Boolean).join(' · ')}</span>}
                  </span>
                  <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="icon-btn" aria-label="Move down" disabled={i === ids.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="icon-btn" aria-label="Remove" onClick={() => setIds((xs) => xs.filter((_, k) => k !== i))}>×</button>
                </li>
              );
            })}
          </ol>
        ) : <p className="card-flat px-4 py-3 text-[13.5px] text-on-surface-variant">Tap drills below to add them.</p>}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="eyebrow">Your drills</p>
          <Link href={newDrillHref} className="text-[13px] font-semibold text-on-surface underline underline-offset-4">New drill</Link>
        </div>
        {drills.length > 6 && (
          <label className="text-field mb-2"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a drill" /></label>
        )}
        {drills.length ? (
          <ul className="card divide-y divide-outline-variant">
            {shown.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => setIds((xs) => [...xs, d.id])}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold text-on-surface">{d.name}</span>
                    <span className="block truncate text-[12.5px] text-on-surface-variant">{[d.amount, `${d.minutes} min`].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-on-surface">{ids.includes(d.id) ? 'Again' : 'Add'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card-flat px-4 py-3 text-[13.5px] text-on-surface-variant">
            No drills yet. <Link href={newDrillHref} className="font-semibold text-on-surface underline underline-offset-4">Add your first</Link>.
          </p>
        )}
      </section>

      <FormError error={err} />
      <button type="button" disabled={busy} className="btn-primary pressable w-full"
              onClick={() => start(async () => {
                const r = await saveSession({ id: session?.id, programId, week, name, drillIds: ids });
                if (r && !r.ok) setErr(r.error);
              })}>
        {busy ? 'Saving…' : 'Save session'}
      </button>
      {session && (
        <>
          <button type="button" onClick={() => setConfirm(true)}
                  className="w-full text-center text-[13px] font-semibold text-on-surface-variant underline underline-offset-4">Delete this session</button>
          <ConfirmSheet open={confirm} title="Delete this session?" confirmLabel="Delete"
            body={`It comes out of week ${week}. The drills stay.`}
            onCancel={() => setConfirm(false)}
            onConfirm={async () => { await deleteSession(session.id); window.location.href = `/coach/programs/${programId}#week-${week}`; }} />
        </>
      )}
    </div>
  );
}
