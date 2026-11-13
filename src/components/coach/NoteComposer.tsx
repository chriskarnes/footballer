'use client';
import { offline } from '@/lib/plain-error';
import { useState, useTransition } from 'react';
import { Chip } from '@/components/Chip';
import { sendNote } from '@/app/coach/actions';

export type NotePlayer = { id: string; name: string };
export type NoteGroup = { id: string; name: string; members: string[] };
/** Who a note starts out addressed to. */
export type NoteTo = { mode: 'everyone' } | { mode: 'groups'; ids: string[] } | { mode: 'players'; ids: string[] };

const QUICK = [
  'Great work this week. Keep it going!',
  'Big game Saturday. One light session before then.',
  'Focus on your weak foot this week.',
];

/**
 * Who it's to, then what it says.
 *
 * "To" is one of three things, picked first: everyone, whole groups, or
 * named players. Groups and players used to be chips in one cloud, where
 * ticking a group silently ticked names below it; now each has its own list
 * and the Send button says how many people that comes to.
 *
 * `fixed` is a note that already knows its one reader (from their page, or
 * a Nudge): no picker, just their name.
 */
export function NoteComposer({ players, groups = [], initial, fixed, initialBody, kind, onSent }: {
  players: NotePlayer[]; groups?: NoteGroup[]; initial: NoteTo; fixed?: NotePlayer;
  initialBody: string; kind: 'note' | 'nudge';
  /** How many it went to, and who, so one can be named. */
  onSent?: (count: number, ids: string[]) => void;
}) {
  const usable = groups.filter((g) => g.members.length);
  const [mode, setMode] = useState<NoteTo['mode']>(initial.mode);
  const [groupIds, setGroupIds] = useState<string[]>(initial.mode === 'groups' ? initial.ids : []);
  const [playerIds, setPlayerIds] = useState<string[]>(initial.mode === 'players' ? initial.ids : []);
  const [body, setBody] = useState(initialBody);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const flip = (list: string[], id: string) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  // The people this comes to: a player in two picked groups gets it once.
  const to = fixed ? [fixed.id]
    : mode === 'everyone' ? players.map((p) => p.id)
    : mode === 'groups' ? [...new Set(usable.filter((g) => groupIds.includes(g.id)).flatMap((g) => g.members))]
    : playerIds;
  const who = fixed ? fixed.name.split(' ')[0]
    : mode === 'everyone' ? 'everyone'
    : to.length === 1 ? players.find((p) => p.id === to[0])?.name.split(' ')[0] ?? '1 player'
    : `${to.length} players`;

  function send() {
    setErr('');
    start(async () => {
      const r = await sendNote({ body, to: !fixed && mode === 'everyone' ? null : to, kind }).catch(offline);
      if (r && !r.ok) setErr(r.error);
      else if (r?.ok) onSent?.(to.length, to);
    });
  }

  const MODES: { key: NoteTo['mode']; label: string }[] = [
    { key: 'everyone', label: 'Everyone' },
    ...(usable.length ? [{ key: 'groups' as const, label: 'Groups' }] : []),
    { key: 'players', label: 'Players' },
  ];

  return (
    <div>
      <p className="eyebrow mb-2.5">To</p>
      {fixed ? (
        <p className="text-body-lg font-bold text-on-surface">{fixed.name}</p>
      ) : (
        <>
          <div className="segmented" role="radiogroup" aria-label="Send to">
            {MODES.map((m) => (
              <button key={m.key} type="button" role="radio" aria-checked={mode === m.key}
                      onClick={() => setMode(m.key)}
                      className={`segment pressable ${mode === m.key ? 'segment-on' : ''}`}>{m.label}</button>
            ))}
          </div>
          <div className="mt-3 min-h-[44px]">
            {mode === 'everyone' && (
              <p className="pt-2.5 text-body text-on-surface-variant">All {players.length} {players.length === 1 ? 'player' : 'players'} in the academy.</p>
            )}
            {mode === 'groups' && (
              <div className="flex flex-wrap gap-2">
                {usable.map((g) => (
                  <Chip key={g.id} on={groupIds.includes(g.id)} onClick={() => setGroupIds((l) => flip(l, g.id))}>
                    {g.name} <span className="font-normal text-on-surface-variant">{g.members.length}</span>
                  </Chip>
                ))}
              </div>
            )}
            {mode === 'players' && (
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto p-1 -m-1">
                {players.map((p) => (
                  <Chip key={p.id} on={playerIds.includes(p.id)} onClick={() => setPlayerIds((l) => flip(l, p.id))}>{p.name}</Chip>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <p className="eyebrow mb-2.5 mt-6">Message</p>
      <label className="text-field">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000}
                  aria-label="Message" placeholder="Write a note…" />
      </label>
      {!body && (
        <div className="card-flat mt-3 divide-y divide-outline-variant overflow-hidden">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setBody(q)}
                    className="pressable block w-full px-4 py-2.5 text-left text-body text-on-surface">{q}</button>
          ))}
        </div>
      )}

      <button type="button" disabled={pending || !body.trim() || !to.length} onClick={send}
              className="btn-primary pressable mt-6 w-full">
        {pending ? 'Sending…' : !to.length ? (mode === 'groups' ? 'Pick a group' : 'Pick a player') : `Send to ${who}`}
      </button>
      <p className="mt-3 text-center text-body-sm text-on-surface-variant">Players see it in the app and can&rsquo;t reply.</p>
      {err && <p role="alert" className="mt-3 text-body font-semibold text-on-surface">Couldn&rsquo;t send: {err}</p>}
    </div>
  );
}
