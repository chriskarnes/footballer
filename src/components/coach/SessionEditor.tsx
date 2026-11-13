'use client';
import { useMemo, useState, useTransition } from 'react';
import { saveSession, deleteSession, saveLibrarySession, deleteLibrarySession } from '@/app/coach/content-actions';
import { ConfirmSheet } from '@/components/ConfirmSheet';
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
 *            Save changes it everywhere it's used; when that's more than this
 *            one place there is a second button to save it as a new session
 *            for this week alone.
 *   legacy   a program week before migration 0017: the session is the week's own.
 */
export type SessionTarget =
  | { kind: 'library'; id?: string; usedIn: string[]; back?: string }
  | { kind: 'placed'; programId: string; week: number; placementId?: string; libraryId?: string | null; alsoIn: string[] }
  | { kind: 'legacy'; programId: string; week: number; id?: string };

export function SessionEditor({ target, session, drills: given }: {
  target: SessionTarget;
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
          <span className="text-[14px] text-on-surface-variant">{ids.length} {ids.length === 1 ? 'drill' : 'drills'} · {minutes} min</span>
        </div>
        {ids.length ? (
          <ol className="card divide-y divide-outline-variant">
            {ids.map((id, i) => {
              const d = byId.get(id);
              return (
                <li key={`${id}-${i}`} className="flex items-center gap-2 py-2.5 pl-4 pr-2">
                  <span className="w-5 shrink-0 text-[14px] font-bold text-on-surface-variant">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-on-surface">{d?.name ?? 'Deleted drill'}</span>
                    {d && <span className="block truncate text-[13px] text-on-surface-variant">{[d.amount, `${d.minutes} min`].filter(Boolean).join(' · ')}</span>}
                  </span>
                  <button type="button" className="icon-btn" aria-label={`Move ${d?.name ?? 'drill'} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="icon-btn" aria-label={`Move ${d?.name ?? 'drill'} down`} disabled={i === ids.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="icon-btn" aria-label={`Remove ${d?.name ?? 'drill'}`} onClick={() => setIds((xs) => xs.filter((_, k) => k !== i))}>×</button>
                </li>
              );
            })}
          </ol>
        ) : <p className="card-flat px-4 py-3 text-[14px] text-on-surface-variant">Tap drills below to add them.</p>}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="eyebrow">Your drills</p>
          {!writing && <button type="button" onClick={() => setWriting(true)} className="text-[14px] font-semibold text-on-surface underline underline-offset-4">New drill</button>}
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
          <ul className="card divide-y divide-outline-variant">
            {shown.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => setIds((xs) => [...xs, d.id])}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold text-on-surface">{d.name}</span>
                    <span className="block truncate text-[13px] text-on-surface-variant">{[d.amount, `${d.minutes} min`].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 text-[14px] font-bold text-on-surface">{ids.includes(d.id) ? 'Again' : 'Add'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card-flat px-4 py-3 text-[14px] text-on-surface-variant">
            No drills yet. <button type="button" onClick={() => setWriting(true)} className="font-semibold text-on-surface underline underline-offset-4">Add your first</button>.
          </p>
        )}
        </>}
      </section>

      <FormError error={err} />
      {(() => {
        const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) => start(async () => {
          setErr('');
          const r = await fn();
          if (r && !r.ok) setErr(r.error ?? 'Couldn’t save.');
        });
        const body = { name, drillIds: ids };
        if (target.kind === 'legacy') {
          const { programId, week, id } = target;
          return (
            <>
              <button type="button" disabled={busy} className="btn-primary pressable w-full"
                      onClick={() => run(() => saveSession({ id, programId, week, ...body }))}>
                {busy ? 'Saving…' : 'Save session'}
              </button>
              {id && <Remove label="Delete this session" title="Delete this session?" confirm="Delete"
                             body={`It comes out of week ${week}. The drills stay.`}
                             run={() => deleteSession(id)} then={`/coach/programs/${programId}#week-${week}`} />}
            </>
          );
        }
        if (target.kind === 'library') {
          const { id, usedIn } = target;
          return (
            <>
              {!!usedIn.length && (
                <p className="text-[14px] leading-snug text-on-surface-variant">
                  Used in <b className="font-semibold text-on-surface">{usedIn.join(', ')}</b>. Saving changes it there too.
                </p>
              )}
              <button type="button" disabled={busy} className="btn-primary pressable w-full"
                      onClick={() => run(() => saveLibrarySession({ libraryId: id, ...body, back: target.back ?? '/coach/sessions' }))}>
                {busy ? 'Saving…' : 'Save session'}
              </button>
              {id && (usedIn.length
                ? <p className="text-center text-[14px] text-on-surface-variant">To delete it, take it out of those weeks first.</p>
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
              <p className="text-[14px] leading-snug text-on-surface-variant">
                Also used in <b className="font-semibold text-on-surface">{alsoIn.join(', ')}</b>.
              </p>
            )}
            <button type="button" disabled={busy} className="btn-primary pressable w-full"
                    onClick={() => run(() => saveLibrarySession(
                      !placementId ? { ...body, place: { programId, week }, back }
                        : libraryId ? { libraryId, ...body, back }
                        : { relink: placementId, ...body, back }))}>
              {busy ? 'Saving…' : shared ? `Save everywhere it’s used` : 'Save session'}
            </button>
            {shared && placementId && (
              <button type="button" disabled={busy} className="btn-ghost pressable w-full"
                      onClick={() => run(() => saveLibrarySession({ relink: placementId, ...body, back }))}>
                Save as a new session, for week {week} only
              </button>
            )}
            {placementId && <Remove label={`Take it out of week ${week}`} title={`Take it out of week ${week}?`} confirm="Take out"
                                    body="It stays in your sessions, and anywhere else it’s used."
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
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
              className="w-full text-center text-[14px] font-semibold text-on-surface-variant underline underline-offset-4">{label}</button>
      {err && <p role="alert" className="text-center text-[14px] font-semibold text-on-surface">{err}</p>}
      <ConfirmSheet open={open} busy={busy} title={title} confirmLabel={confirm} body={body}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          const r = await run();
          if (r.ok) window.location.href = then; else { setBusy(false); setOpen(false); setErr(r.error ?? 'Couldn’t do that.'); }
        }} />
    </>
  );
}
