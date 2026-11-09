'use client';
import { useState, useTransition } from 'react';
import { Chip } from '@/components/Chip';
import { sendNote } from '@/app/coach/actions';

type P = { id: string; name: string };

const QUICK = [
  'Great work this week. Keep it going!',
  'Big game Saturday. One light session before then.',
  'Focus on your weak foot this week.',
];

/**
 * Who it's to, then what it says. "Everyone" is the default when nobody's
 * picked, so a note to the whole group is one tap; picking players narrows
 * it. The players who need attention are listed first.
 */
export function NoteComposer({ players, initialTo, initialBody, kind, back }: {
  players: P[]; initialTo: string[]; initialBody: string; kind: 'note' | 'nudge'; back: string;
}) {
  const [to, setTo] = useState<string[]>(initialTo);
  const [body, setBody] = useState(initialBody);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const everyone = to.length === 0;
  const toggle = (id: string) => setTo((t) => t.includes(id) ? t.filter((x) => x !== id) : [...t, id]);

  function send() {
    setErr('');
    start(async () => {
      // On success the action redirects, so a result here is an error.
      const r = await sendNote({ body, to: everyone ? null : to, kind, back });
      if (r && !r.ok) setErr(r.error);
    });
  }

  return (
    <div className="mt-6">
      <p className="eyebrow mb-2.5">To</p>
      <div className="flex flex-wrap gap-2">
        <Chip on={everyone} onClick={() => setTo([])}>Everyone ({players.length})</Chip>
        {players.map((p) => (
          <Chip key={p.id} on={to.includes(p.id)} onClick={() => toggle(p.id)}>{p.name}</Chip>
        ))}
      </div>

      <p className="eyebrow mb-2.5 mt-6">Message</p>
      <label className="text-field">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1000}
                  aria-label="Message" placeholder="Write a note…" />
      </label>
      {!body && (
        <div className="mt-3 card-flat divide-y divide-outline-variant overflow-hidden">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setBody(q)}
                    className="pressable block w-full px-4 py-3 text-left text-[14px] text-on-surface">{q}</button>
          ))}
        </div>
      )}

      <button type="button" disabled={pending || !body.trim()} onClick={send}
              className="btn-primary pressable mt-6 w-full disabled:opacity-50">
        {pending ? 'Sending…' : everyone ? `Send to everyone` : `Send to ${to.length === 1 ? players.find((p) => p.id === to[0])?.name.split(' ')[0] : `${to.length} players`}`}
      </button>
      {err && <p role="status" className="mt-3 text-[13px] font-semibold text-on-surface">Couldn&rsquo;t send: {err}</p>}
    </div>
  );
}
