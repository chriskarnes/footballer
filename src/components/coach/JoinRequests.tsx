'use client';
import { offline } from '@/lib/plain-error';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/coach/Toast';
import { answerJoinRequest } from '@/app/coach/actions';

export type JoinRequest = {
  user_id: string; name: string; message: string | null; created_at: string; when: string;
  /** From 0027: a trainer link asks the owner; a parent may be asking for their player. */
  role?: 'player' | 'trainer'; as_who?: 'player' | 'parent' | null;
};

/**
 * Players who found the academy and asked to join, oldest first, and
 * trainers who opened the trainer link. Let in makes them a player (or a
 * trainer: the owner only); Decline tells them so, and they can ask again.
 */
export function JoinRequests({ requests, owner }: { requests: JoinRequest[]; owner: boolean }) {
  const [gone, setGone] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const toast = useToast();
  const left = requests.filter((r) => !gone.includes(r.user_id));
  if (!left.length) return null;

  const answer = (id: string, yes: boolean) => start(async () => {
    const shown = requests.find((x) => x.user_id === id)?.role === 'trainer' ? 'trainer' : 'player';
    const r = await answerJoinRequest(id, yes, shown).catch(offline);
    if (r.ok) { setGone((g) => [...g, id]); toast(r.already ? 'Someone already answered that one.' : yes ? 'Let in.' : 'Declined.'); }
    else setErr(r.error);
  });

  return (
    <section className="mt-6 lg:max-w-2xl">
      <p className="eyebrow mb-3">Asking to join</p>
      <ul className="card divide-y divide-outline-variant">
        {left.map((r) => (
          <li key={r.user_id} className="px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-body-lg font-bold text-on-surface">{r.name}</span>
              <span className="shrink-0 text-body-sm text-on-surface-variant">{r.when}</span>
            </div>
            <p className="mt-0.5 text-body-sm font-semibold text-on-surface-variant">
              {r.role === 'trainer' ? 'As a trainer: sees every player' : r.as_who === 'parent' ? 'A parent, for their player' : 'Player'}
            </p>
            {r.message && <p className="mt-1 text-body leading-snug text-on-surface-variant">{r.message}</p>}
            {r.role === 'trainer' && !owner ? (
              <p className="mt-3 text-body-sm text-on-surface-variant">The academy&rsquo;s owner lets trainers in.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {/* Named, so a list of them reads "Let Sam in", not "Let in, Let in". */}
                <button type="button" disabled={busy} className="btn-primary btn-sm pressable" onClick={() => answer(r.user_id, true)}
                        aria-label={r.role === 'trainer' ? `Let ${r.name} in as trainer` : `Let ${r.name} in`}>
                  {r.role === 'trainer' ? 'Let in as trainer' : 'Let in'}
                </button>
                <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => answer(r.user_id, false)}
                        aria-label={`Decline ${r.name}`}>Decline</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-2 text-body font-semibold text-on-surface">{err}</p>}
    </section>
  );
}
