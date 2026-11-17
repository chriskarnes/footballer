'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendNudges } from '@/app/coach/actions';
import { offline } from '@/lib/plain-error';
import { useToast } from './Toast';

/**
 * One button for the headline's "6 players need a nudge": each gets their
 * own note, written from their own week, shown here first so nothing goes
 * out unread. Untick anyone it shouldn't go to.
 */
export function NudgeAll({ people }: { people: { id: string; name: string; body: string }[] }) {
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const going = people.filter((p) => !skip.has(p.id));
  const close = () => { setOpen(false); setErr(''); };
  const send = () => start(async () => {
    setErr('');
    const r = await sendNudges(going.map((p) => ({ to: p.id, body: p.body }))).catch(offline);
    if (!r.ok) {
      // The ones that went come off the list, so trying again can't send twice.
      const gone = 'sent' in r ? r.sent : [];
      if (gone.length) setSkip((s) => new Set([...s, ...gone]));
      setErr(r.error);
      return;
    }
    close(); setSkip(new Set());
    toast(`Nudged ${r.sent} ${r.sent === 1 ? 'player' : 'players'}.`);
    router.refresh();
  });

  if (people.length < 2) return null;
  return (
    <>
      <button type="button" className="btn-ghost btn-sm pressable" onClick={() => setOpen(true)}>Nudge all {people.length}</button>
      <dialog ref={ref} className="note-dialog" aria-labelledby="nudge-all-title"
              onCancel={(e) => { e.preventDefault(); close(); }}
              onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        {open && (
          <div className="note-panel">
            <h2 id="nudge-all-title" className="h-card">Nudge {going.length} {going.length === 1 ? 'player' : 'players'}</h2>
            <p className="mt-1 text-body text-on-surface-variant">Each gets their own note. Untick anyone to leave out.</p>
            <ul className="mt-4 divide-y divide-outline-variant border-y border-outline-variant">
              {people.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-start gap-3 py-3">
                    <input type="checkbox" className="mt-1 size-4.5 shrink-0" checked={!skip.has(p.id)}
                           onChange={() => setSkip((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                    <span className={`min-w-0 ${skip.has(p.id) ? 'opacity-50' : ''}`}>
                      <span className="block text-body font-bold text-on-surface">{p.name}</span>
                      <span className="mt-0.5 block text-body-sm leading-snug text-on-surface-variant">{p.body}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
            <div className="mt-5 flex gap-2.5">
              <button type="button" className="btn-ghost min-h-13 flex-1" onClick={close}>Cancel</button>
              <button type="button" disabled={busy || !going.length} className="btn-primary pressable flex-1" onClick={send}>
                {busy ? 'Sending…' : `Send ${going.length}`}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
