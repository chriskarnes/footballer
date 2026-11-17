'use client';
import { useState, useTransition } from 'react';
import { addStarterSessions, duplicateProgram } from '@/app/coach/content-actions';
import { offline } from '@/lib/plain-error';

type Result = { ok: true } | { ok: false; error: string };

function ActionButton({ run, label, busyLabel, className }: { run: () => Promise<Result>; label: string; busyLabel: string; className: string }) {
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  return (
    <>
      <button type="button" disabled={busy} className={className}
              onClick={() => start(async () => { setErr(''); const r = await run().catch(offline); if (r && !r.ok) setErr(r.error); })}>
        {busy ? busyLabel : label}
      </button>
      {err && <p role="alert" className="basis-full text-body-sm font-semibold text-on-surface">{err}</p>}
    </>
  );
}

/** A second program from the first: the same weeks and sessions, under a new name, given to nobody. */
export function DuplicateProgram({ id }: { id: string }) {
  return <ActionButton run={() => duplicateProgram(id)} label="Duplicate" busyLabel="Copying…" className="btn-ghost btn-sm pressable" />;
}

/** Six plain drills and two sessions made of them, to edit or delete: something to start from. */
export function AddStarters() {
  return <ActionButton run={() => addStarterSessions()} label="Add two example sessions" busyLabel="Adding…" className="btn-ghost btn-sm pressable" />;
}
