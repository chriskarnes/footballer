'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { DrillBrief, SessionRow } from '@/lib/types';
import { WEEKDAYS } from '@/lib/types';

export interface WeekRow {
  weekday: number;
  slot: number;
  kind: string;
  session: SessionRow | null;
  /** Why this session is here. Empty on a saved week, where the reasoning has
   *  already been accepted and the day just needs to be legible. */
  reason?: string;
}

/**
 * The week, shared by the builder and the saved view so a day looks and behaves
 * the same in both.
 *
 * Days expand to their drills in place. Navigating away to see what "Skill Moves"
 * actually involves would throw away an unsaved week in the builder, and in the
 * saved view it would mean a round trip just to answer "what is this".
 */
export function PlanWeek({
  rows, drillsBySession,
}: { rows: WeekRow[]; drillsBySession: Record<string, DrillBrief[]> }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ol className="mt-3 space-y-2">
      {rows.map((d) => {
        const key = `${d.weekday}-${d.slot}`;
        const drills = d.session ? drillsBySession[d.session.id] ?? [] : [];
        const isOpen = open === key;

        if (d.kind === 'rest') {
          return (
            <li key={key} className="flex items-center gap-3.5 px-4 py-2">
              <span className="w-10 shrink-0 font-brand text-[13px] font-bold text-on-surface-variant">
                {WEEKDAYS[d.weekday]}
              </span>
              <span className="text-[13.5px] text-on-surface-variant">Rest</span>
            </li>
          );
        }

        return (
          <li key={key} className="card p-4">
            <div className="flex items-start gap-3.5">
              <span className="mt-0.5 w-10 shrink-0 font-brand text-[13px] font-bold text-on-surface">
                {WEEKDAYS[d.weekday]}
              </span>

              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : key)}
                disabled={!d.session}
                aria-expanded={isOpen}
                className="min-w-0 flex-1 text-left disabled:cursor-default"
              >
                {/* Wraps rather than truncates. The Start button already takes a
                    third of the row, and "Weeks 1-4 (Day 3) First Touch On The
                    Ground" cut to "Weeks 1-4 (Day 3) First…" tells you nothing. */}
                <span className="flex items-start gap-1.5">
                  <span className="min-w-0 text-[14.5px] font-bold leading-snug text-on-surface">
                    {d.session?.name ?? 'Nothing fits this day'}
                  </span>
                  {!!d.session && (
                    <svg viewBox="0 0 24 24" aria-hidden="true"
                      className={`mt-[3px] h-3.5 w-3.5 shrink-0 text-on-surface-variant transition-transform
                                  duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth="2.6"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  )}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-on-surface-variant">
                  {d.session
                    ? `${Math.round(d.session.total_minutes)} min · ${drills.length} drill${
                        drills.length === 1 ? '' : 's'}${d.reason ? ` · ${d.reason}` : ''}`
                    : 'Try adding kit, or turning off Home only'}
                </span>
              </button>

              {d.session && (
                <Link href={`/session/${d.session.id}`}
                  className="btn-primary shrink-0 px-3 py-2 text-xs">
                  Start
                </Link>
              )}
            </div>

            {isOpen && !!drills.length && (
              <ol className="mt-3.5 space-y-1.5 border-t border-outline-variant pt-3.5">
                {drills.map((x, i) => (
                  <li key={x.id} className="flex items-baseline gap-2.5">
                    <span className="w-4 shrink-0 font-brand text-[11px] font-bold text-on-surface-variant">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] font-medium text-on-surface">
                      {x.name}
                      <span className="ml-1.5 text-[12px] text-on-surface-variant">
                        {x.sets} × {x.reps_time}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-on-surface-variant">
                      {x.total_seconds < 60
                        ? `${x.total_seconds}s`
                        : `${Math.round(x.total_seconds / 60)}m`}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {isOpen && !drills.length && (
              <p className="mt-3.5 border-t border-outline-variant pt-3.5 text-[13px] text-on-surface-variant">
                This session&rsquo;s drills aren&rsquo;t in the library yet.
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
