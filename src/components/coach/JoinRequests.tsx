'use client';
import { useState, useTransition } from 'react';
import { answerJoinRequest } from '@/app/coach/actions';

export type JoinRequest = { user_id: string; name: string; message: string | null; created_at: string; when: string };

/**
 * Players who found the academy and asked to join, oldest first. Let in
 * makes them a player; Decline just removes the request (they can ask again).
 */
export function JoinRequests({ requests }: { requests: JoinRequest[] }) {
  const [gone, setGone] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const left = requests.filter((r) => !gone.includes(r.user_id));
  if (!left.length) return null;

  const answer = (id: string, yes: boolean) => start(async () => {
    const r = await answerJoinRequest(id, yes);
    if (r.ok) setGone((g) => [...g, id]); else setErr(r.error);
  });

  return (
    <section className="mt-6">
      <p className="eyebrow mb-3">Asking to join</p>
      <ul className="card divide-y divide-outline-variant">
        {left.map((r) => (
          <li key={r.user_id} className="px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px] font-bold text-on-surface">{r.name}</span>
              <span className="shrink-0 text-[12.5px] text-on-surface-variant">{r.when}</span>
            </div>
            {r.message && <p className="mt-1 text-[13.5px] leading-snug text-on-surface-variant">{r.message}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button type="button" disabled={busy} className="btn-primary btn-sm pressable" onClick={() => answer(r.user_id, true)}>Let in</button>
              <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => answer(r.user_id, false)}>Decline</button>
            </div>
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-2 text-[13px] font-semibold text-on-surface">{err}</p>}
    </section>
  );
}
