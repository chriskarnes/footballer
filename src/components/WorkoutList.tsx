'use client';
import { useNow } from '@/lib/use-now';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatTouches } from '@/lib/session-builder';
import { relativeDay } from '@/lib/training-stats';
import { ConfirmSheet } from './ConfirmSheet';

export type WorkoutRow = {
  id: string;
  title: string;
  /** Finished, or saved from Train for later. */
  done: boolean;
  /** completed_at for a finished one, created_at for a saved one. */
  at: string;
  minutes: number;
  touches: number;
  drills: number;
  /** How many of `drills` were ticked. Equal to `drills` for a full session —
   *  including older rows, which never recorded it. */
  ticked: number;
};

/**
 * A list of sessions, in one of two kinds — the two things "Do it again" used
 * to mix together:
 *
 *   saved     sessions kept from Train to do later: Start, or remove
 *   history   sessions done: what was done, and do it again
 *
 * The whole row is the link, and says what a tap does in a word, Start or
 * Again. It was a glyph in a 36px button whose meaning was only in its
 * tooltip, which a phone never shows. The word sits in a ghost button, not a
 * black one — twenty-five of the app's strongest button down one list said
 * nothing about which one mattered.
 *
 * Removing a saved session is one worded button under the list, as deleting a
 * test day is on the speed card: a bin beside Start on every row was one
 * slip of the thumb from the wrong one.
 */
export function WorkoutList({ rows: initial, kind }: { rows: WorkoutRow[]; kind: 'saved' | 'history' }) {
  // The rows follow the page: a session PendingSaves sent from the phone
  // arrives with a refresh, and a list copied once into state never showed
  // it. What this list deleted stays gone, even before the refresh catches up.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const router = useRouter();
  const rows = initial.filter((w) => !removed.has(w.id));
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const now = useNow();

  async function remove(id: string) {
    setBusy(true); setErr('');
    const res = await fetch(`/api/workouts?id=${id}`, { method: 'DELETE' }).catch(() => null);
    setBusy(false); setConfirm(null);
    // And the page follows: deleting the last one takes the "Saved for later"
    // heading with it, rather than leaving it over nothing.
    if (res?.ok) { setRemoved((r) => new Set(r).add(id)); router.refresh(); }
    else setErr(res ? 'Couldn’t delete it. Try again.' : 'No signal. Try again.');
  }
  // Which one Delete takes off: the one picked in the sheet.
  const asking = rows.find((w) => w.id === confirm);

  return (
    <>
    <ul className="space-y-2">
      {rows.map((w) => {
        const partial = w.done && w.ticked < w.drills;
        const facts = [
          w.done && now ? relativeDay(w.at, now) : null,
          partial ? `${w.ticked} of ${w.drills} drills` : null,
          w.minutes ? `${Math.round(w.minutes)} min` : null,
          w.touches ? `${formatTouches(w.touches)} touches` : null,
        ].filter(Boolean).join(' · ');

        return (
          <li key={w.id}>
            <Link href={`/session/${w.id}?from=history`} className="card pressable flex items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="h-card block truncate">{w.title}</span>
                <span className="mt-1 block text-body-sm font-medium text-on-surface-variant">{facts}</span>
              </span>
              <span className="btn-ghost btn-sm shrink-0">{kind === 'saved' ? 'Start' : 'Again'}</span>
            </Link>
          </li>
        );
      })}
    </ul>
    {kind === 'saved' && !!rows.length && (
      <button type="button" onClick={() => { setErr(''); setConfirm(rows[0].id); }} className="btn-ghost pressable mt-3">
        Delete a saved session
      </button>
    )}
    {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    <ConfirmSheet open={!!asking} busy={busy} title={rows.length > 1 ? 'Delete a saved session?' : `Delete ${asking?.title ?? ''}?`}
                  body={<>
                    {rows.length > 1 && (
                      <label className="text-field mb-3 block">
                        <span>Session</span>
                        <select value={confirm ?? ''} onChange={(e) => setConfirm(e.target.value)}>
                          {rows.map((w) => <option key={w.id} value={w.id}>{w.title}{w.minutes ? ` · ${Math.round(w.minutes)} min` : ''}</option>)}
                        </select>
                      </label>
                    )}
                    It comes off your saved sessions. Anything you’ve done stays in your training.
                  </>}
                  confirmLabel="Delete" onConfirm={() => asking && remove(asking.id)} onCancel={() => setConfirm(null)} />
    </>
  );
}
