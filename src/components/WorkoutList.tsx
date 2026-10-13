'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatTouches } from '@/lib/session-builder';
import { relativeDay } from '@/lib/training-stats';

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
 * Each row's action is a glyph in the 36px tonal button the drills use, not a
 * black Again button — twenty-five of the app's strongest button down one list
 * said nothing about which one mattered.
 */
export function WorkoutList({ rows: initial, kind }: { rows: WorkoutRow[]; kind: 'saved' | 'history' }) {
  const [rows, setRows] = useState(initial);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  // Relative days need the player's clock; the server's would call a
  // Sunday-evening session Monday's.
  useEffect(() => { setNow(new Date()); }, []);

  async function remove(id: string) {
    const res = await fetch(`/api/workouts?id=${id}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) { setRows((r) => r.filter((x) => x.id !== id)); setConfirm(null); }
  }

  return (
    <ul className="space-y-2">
      {rows.map((w) => {
        const partial = w.done && w.ticked < w.drills;
        const facts = [
          w.done && now ? relativeDay(w.at, now) : null,
          partial ? `${w.ticked} of ${w.drills} drills` : null,
          w.minutes ? `${Math.round(w.minutes)} min` : null,
          w.touches ? `${formatTouches(w.touches)} touches` : null,
        ].filter(Boolean).join(' · ');

        if (confirm === w.id) {
          return (
            <li key={w.id} className="card p-4">
              <p className="text-[14px] font-medium text-on-surface">Remove {w.title}?</p>
              <div className="mt-3 flex gap-2.5">
                <button type="button" onClick={() => setConfirm(null)} className="btn-ghost flex-1">Keep it</button>
                <button type="button" onClick={() => remove(w.id)} className="btn-primary btn-sm flex-1">Remove</button>
              </div>
            </li>
          );
        }

        return (
          <li key={w.id} className="card flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="h-card truncate">{w.title}</div>
              <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">{facts}</div>
            </div>
            {kind === 'saved' && (
              <button type="button" onClick={() => setConfirm(w.id)}
                      aria-label={`Remove ${w.title}`} title="Remove"
                      className="icon-btn pressable text-on-surface-variant hover:text-on-surface">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true"
                     stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
                </svg>
              </button>
            )}
            <Link href={`/session/${w.id}?from=history`}
                  aria-label={kind === 'saved' ? `Start ${w.title}` : `Do ${w.title} again`}
                  title={kind === 'saved' ? 'Start' : 'Do it again'}
                  className="icon-btn pressable">
              {kind === 'saved' ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true"
                     stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
                </svg>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
