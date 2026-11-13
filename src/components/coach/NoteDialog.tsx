'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import { NoteComposer, type NoteGroup, type NotePlayer, type NoteTo } from './NoteComposer';

type Person = NotePlayer & { nudge?: string };
/** What a button asks for: a note to a group, to one player, or a nudge for them. */
type Ask = { group?: string; to?: string; kind?: 'note' | 'nudge' };

const Ctx = createContext<(ask: Ask) => void>(() => {});

/**
 * Sending a note without leaving the page: a dialog in the middle of a
 * laptop screen, a sheet that slides up from the bottom of a phone. One per
 * page, opened by any <NoteButton> inside it. See .note-dialog in globals.css.
 *
 * `players` is everyone the page knows about. A page about one player passes
 * just them with `only`, and the note is theirs, with nobody to pick.
 */
export function NoteProvider({ players, groups = [], only = false, children }: {
  players: Person[]; groups?: NoteGroup[]; only?: boolean; children: React.ReactNode;
}) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const setToast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ask && !d.open) d.showModal();
    if (!ask && d.open) d.close();
  }, [ask]);

  const person = ask?.to ? players.find((p) => p.id === ask.to) : undefined;
  const group = ask?.group ? groups.find((g) => g.id === ask.group) : undefined;
  const nudge = ask?.kind === 'nudge' && !!person;
  const fixed = person && (only || nudge) ? person : undefined;
  const initial: NoteTo = person ? { mode: 'players', ids: [person.id] }
    : group ? { mode: 'groups', ids: [group.id] } : { mode: 'everyone' };
  const first = person?.name.split(' ')[0];
  const title = nudge ? `Nudge ${first}` : fixed ? `Note to ${first}` : 'Send a note';

  return (
    <Ctx.Provider value={setAsk}>
      {children}
      <dialog ref={ref} className="note-dialog" aria-labelledby="note-dialog-title"
              onCancel={(e) => { e.preventDefault(); setAsk(null); }}
              onClick={(e) => { if (e.target === e.currentTarget) setAsk(null); }}>
        {ask && (
          <div className="note-panel">
            <div className="flex items-center justify-between gap-4">
              <h2 id="note-dialog-title" className="h-card">{title}</h2>
              <button type="button" aria-label="Close" onClick={() => setAsk(null)}
                      className="pressable -mr-2 flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="mt-4">
              <NoteComposer players={players} groups={groups} initial={initial} fixed={fixed}
                            initialBody={nudge ? person?.nudge ?? '' : ''} kind={nudge ? 'nudge' : 'note'}
                            onSent={(n, ids) => {
                              setAsk(null);
                              // One player, picked or fixed: by name, as the button said it.
                              const one = n === 1 ? players.find((p) => p.id === (fixed?.id ?? ids[0])) : undefined;
                              setToast(one ? `Sent to ${one.name.split(' ')[0]}.` : `Sent to ${n} ${n === 1 ? 'player' : 'players'}.`);
                              router.refresh();
                            }} />
            </div>
          </div>
        )}
      </dialog>
    </Ctx.Provider>
  );
}

/** A button that opens the page's note dialog, already addressed. */
export function NoteButton({ group, to, kind, className, children }: Ask & { className?: string; children: React.ReactNode }) {
  const open = useContext(Ctx);
  return <button type="button" className={className} onClick={() => open({ group, to, kind })}>{children}</button>;
}
