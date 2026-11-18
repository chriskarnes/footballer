'use client';
import { offline } from '@/lib/plain-error';
import { useMemo, useState, useTransition } from 'react';
import { saveSession, deleteSession, saveLibrarySession, deleteLibrarySession } from '@/app/coach/content-actions';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import type { DrillRow } from '@/lib/academy-week';
import { Field, FormError } from './Field';
import { DrillForm } from './DrillForm';

/**
 * A session: a name and drills in order. Tap a drill to add it, use the
 * arrows to reorder. The total time is the sum of the drills.
 *
 * A drill that doesn't exist yet is written right here: the form opens in
 * place of the drill list, and saving puts the new drill at the end of the
 * session. Nothing typed so far is lost, because the page never changes.
 *
 * `target` is where the session lives, which decides what Save does:
 *   library  a session in the trainer's library, from the Sessions tab.
 *   placed   a session in a program week. With a library session behind it,
 *            Save changes it everywhere it's used, and the line above the
 *            button says where; when that's more than this one place there
 *            is a second button to save a copy for this week alone.
 *   legacy   a program week before migration 0017: the session is the week's own.
 */
export type SessionTarget =
  | { kind: 'library'; id?: string; usedIn: string[]; back?: string }
  | { kind: 'placed'; programId: string; week: number; placementId?: string; libraryId?: string | null; alsoIn: string[] }
  | { kind: 'legacy'; programId: string; week: number; id?: string };

export function SessionEditor({ target, session, drills: given, lastNote }: {
  target: SessionTarget;
  /** Said when removing it: it's the week's last session (see the page). */
  lastNote?: string;
  session?: { name: string; drill_ids: string[] };
  drills: DrillRow[];
}) {
  // Drills written here, until the page's own list catches up.
  const [made, setMade] = useState<DrillRow[]>([]);
  const [writing, setWriting] = useState(false);
  const drills = useMemo(() => [...given, ...made.filter((m) => !given.some((g) => g.id === m.id))]
    .sort((a, b) => a.name.localeCompare(b.name)), [given, made]);
  const [name, setName] = useState(session?.name ?? '');
  const [ids, setIds] = useState<string[]>(session?.drill_ids ?? []);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
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
          <span className="text-body text-on-surface-variant">{ids.length} {ids.length === 1 ? 'drill' : 'drills'} · {minutes} min</span>
        </div>
        {ids.length ? (
          <ol className="card divide-y divide-outline-variant">
            {ids.map((id, i) => {
              const d = byId.get(id);
              return (
                <li key={`${id}-${i}`} className="flex items-center gap-2 py-2.5 pl-4 pr-2">
                  <span className="w-5 shrink-0 text-body font-bold text-on-surface-variant">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-lg font-semibold text-on-surface">{d?.name ?? 'Deleted drill'}</span>
                    {d && <span className="block truncate text-body-sm text-on-surface-variant">{[d.amount, `${d.minutes} min`].filter(Boolean).join(' · ')}</span>}
                  </span>
                  <button type="button" className="icon-btn" aria-label={`Move ${d?.name ?? 'drill'} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="icon-btn" aria-label={`Move ${d?.name ?? 'drill'} down`} disabled={i === ids.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="icon-btn" aria-label={`Remove ${d?.name ?? 'drill'}`} onClick={() => setIds((xs) => xs.filter((_, k) => k !== i))}>×</button>
                </li>
              );
            })}
          </ol>
        ) : <p className="card-flat px-4 py-3 text-body text-on-surface-variant">No drills in it yet. Add them from the list below.</p>}
      </section>

      <section>
        {/* A drawer of parts, set apart from the session above it: a tinted
            panel and small rows with a plus, so a drill doesn't read as
            another session. */}
        <div className="rounded-large-increased bg-surface-container-low p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <p className="h-card">Add drills</p>
            {!writing && !!drills.length && <p className="mt-0.5 text-body-sm text-on-surface-variant">Tap a drill to put it in the session.</p>}
          </div>
          {!writing && <button type="button" onClick={() => setWriting(true)} className="shrink-0 text-body font-semibold text-on-surface underline underline-offset-4">New drill</button>}
        </div>
        {writing ? (
          <div className="card p-5">
            <div className="h-card mb-4">New drill</div>
            <DrillForm back="" onCancel={() => setWriting(false)}
                       onSaved={(d) => { setMade((m) => [...m, d]); setIds((xs) => [...xs, d.id]); setWriting(false); }} />
          </div>
        ) : <>
        {drills.length > 6 && (
          <label className="text-field mb-2"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a drill" aria-label="Find a drill" /></label>
        )}
        {drills.length ? (
          <ul className="space-y-1">
            {shown.map((d) => {
              const times = ids.filter((x) => x === d.id).length;
              return (
                <li key={d.id}>
                  <button type="button" onClick={() => setIds((xs) => [...xs, d.id])} aria-label={`Add ${d.name} to the session`}
                          className="pressable flex w-full items-center gap-3 rounded-medium px-2 py-2 text-left">
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-outline text-title font-semibold leading-none text-on-surface">+</span>
                    <span className="min-w-0 flex-1 truncate text-body font-semibold text-on-surface">
                      {d.name}
                      <span className="ml-2 font-normal text-on-surface-variant">{[d.amount, `${d.minutes} min`].filter(Boolean).join(' · ')}</span>
                    </span>
                    {times > 0 && <span className="shrink-0 text-body-sm font-semibold text-on-surface-variant">In it{times > 1 ? ` ×${times}` : ''}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card-flat px-4 py-3 text-body text-on-surface-variant">
            No drills yet. <button type="button" onClick={() => setWriting(true)} className="font-semibold text-on-surface underline underline-offset-4">Add your first</button>.
          </p>
        )}
        </>}
        </div>
      </section>

      <FormError error={err} />
      {(() => {
        const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) => start(async () => {
          setErr('');
          const r = await fn().catch(offline);
          if (r && !r.ok) setErr(r.error ?? 'Couldn’t save.');
        });
        const body = { name, drillIds: ids };
        if (target.kind === 'legacy') {
          const { programId, week, id } = target;
          return (
            <>
              <button type="button" disabled={busy} className="btn-primary pressable w-full"
                      onClick={() => run(() => saveSession({ id, programId, week, ...body }))}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              {id && <Remove label="Delete this session" title="Delete this session?" confirm="Delete"
                             body={`It comes out of week ${week}. The drills stay.${lastNote ? ` ${lastNote}` : ''}`}
                             run={() => deleteSession(id)} then={`/coach/programs/${programId}#week-${week}`} />}
            </>
          );
        }
        if (target.kind === 'library') {
          const { id, usedIn } = target;
          return (
            <>
              {!!usedIn.length && (
                <p className="text-body leading-snug text-on-surface-variant">
                  Used in <b className="font-semibold text-on-surface">{usedIn.join(', ')}</b>. Saving changes it there too.
                </p>
              )}
              <button type="button" disabled={busy} className="btn-primary pressable w-full"
                      onClick={() => run(() => saveLibrarySession({ libraryId: id, ...body, back: target.back ?? '/coach/sessions' }))}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              {id && (usedIn.length
                ? <p className="text-center text-body text-on-surface-variant">To delete it, take it out of those weeks first.</p>
                : <Remove label="Delete this session" title="Delete this session?" confirm="Delete"
                          body="It isn’t in any program. The drills stay."
                          run={() => deleteLibrarySession(id)} then="/coach/sessions" />)}
            </>
          );
        }
        const { programId, week, placementId, libraryId, alsoIn } = target;
        const back = `/coach/programs/${programId}#week-${week}`;
        const shared = !!libraryId && alsoIn.length > 0;
        return (
          <>
            {shared && (
              <p className="text-body leading-snug text-on-surface-variant">
                Also used in <b className="font-semibold text-on-surface">{alsoIn.join(', ')}</b>.
              </p>
            )}
            <button type="button" disabled={busy} className="btn-primary pressable w-full"
                    onClick={() => run(() => saveLibrarySession(
                      !placementId ? { ...body, place: { programId, week }, back }
                        : libraryId ? { libraryId, ...body, back }
                        : { relink: placementId, ...body, back }))}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            {shared && placementId && (
              <button type="button" disabled={busy} className="btn-ghost pressable w-full"
                      onClick={() => run(() => saveLibrarySession({ relink: placementId, ...body, back }))}>
                Save a copy just for week {week}
              </button>
            )}
            {placementId && <Remove label={`Remove from week ${week}`} title={`Remove from week ${week}?`} confirm="Remove"
                                    body={`It stays in your sessions, and anywhere else it’s used.${lastNote ? ` ${lastNote}` : ''}`}
                                    run={() => deleteSession(placementId)} then={back} />}
          </>
        );
      })()}
    </div>
  );
}

/** The quiet way out at the bottom of the editor, behind a second tap. */
function Remove({ label, title, body, confirm, run, then }: {
  label: string; title: string; body: string; confirm: string;
  run: () => Promise<{ ok: boolean; error?: string }>; then: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
              className="w-full text-center text-body font-semibold text-on-surface-variant underline underline-offset-4">{label}</button>
      {err && <p role="alert" className="text-center text-body font-semibold text-on-surface">{err}</p>}
      <ConfirmSheet open={open} busy={busy} title={title} confirmLabel={confirm} body={body}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          const r = await run().catch(offline);
          setBusy(false); setOpen(false);
          if (r.ok) { toast(confirm === 'Delete' ? 'Session deleted.' : 'Removed.'); router.push(then); router.refresh(); }
          else setErr(r.error ?? 'Couldn’t do that.');
        }} />
    </>
  );
}
