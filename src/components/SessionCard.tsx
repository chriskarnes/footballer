'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BuiltSession } from '@/lib/types';
import { FOCUS_LABELS, TOUCH_GOAL } from '@/lib/types';
import { formatTouches } from '@/lib/session-builder';
import { sessionTitle } from '@/lib/session-url';

export function SessionCard({
  built, startHref, onSwap, onShuffle,
}: {
  built: BuiltSession;
  /** Where Start goes — the runner, carrying this exact session. */
  startHref: string;
  onSwap: (i: number) => void; onShuffle: () => void;
}) {
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'signin'>('idle');
  const mins = Math.round(built.totalSeconds / 60);

  // "Saved" describes these drills. After a swap or another mix it's a different
  // session, and the button has to be pressable again.
  const ids = built.drills.map((d) => d.id).join();
  useEffect(() => { setSaving((s) => (s === 'saved' ? 'idle' : s)); }, [ids]);
  const pct = Math.min(100, Math.round((built.totalTouches / TOUCH_GOAL) * 100));
  const hit = built.totalTouches >= TOUCH_GOAL;

  async function save() {
    setSaving('saving');
    const res = await fetch('/api/workouts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: sessionTitle(built.spec),
        source: 'coach', spec: built.spec,
        exercise_ids: built.drills.map((d) => d.id),
        planned_minutes: mins, planned_touches: built.totalTouches,
      }),
    });
    setSaving(res.status === 401 ? 'signin' : res.ok ? 'saved' : 'idle');
  }

  if (!built.drills.length) {
    return <div className="card p-6 text-[15px] text-on-surface-variant">
      Nothing matched — try a longer session or a different place.
    </div>;
  }

  return (
    <div>
      {/* The headline number gets the space it deserves — and now the whole card,
          since "Your session" is a heading above this box rather than a second,
          smaller label repeating it inside. */}
      <div className="overflow-hidden rounded-large-increased bg-surface-brand border border-brand-edge p-6 shadow-level3">
        <div className="flex items-end gap-6">
          <div>
            <div className="font-brand text-[46px] font-extrabold leading-none
                            tracking-tightest text-on-surface-brand">
              {formatTouches(built.totalTouches)}
            </div>
            <div className="mt-1.5 text-[12.5px] font-semibold text-on-surface-brand-variant">ball touches</div>
          </div>
          <div className="mb-1 flex gap-6">
            <Metric v={`${mins}`} unit="min" />
            <Metric v={`${built.drills.length}`} unit={built.rounds > 1 ? `× ${built.rounds}` : 'drills'} />
          </div>
        </div>

        <div className="mt-5 h-[6px] overflow-hidden rounded-full bg-brand-track">
          <div className="h-full rounded-full bg-on-surface-brand transition-all duration-700"
               style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2.5 text-[12px] font-medium text-on-surface-brand-variant">
          {hit
            ? `Past the ${TOUCH_GOAL.toLocaleString()} goal — a team practice gives most players a few hundred.`
            : `${formatTouches(TOUCH_GOAL - built.totalTouches)} short of ${TOUCH_GOAL.toLocaleString()}.`}
        </p>

        {/* Start, and beside it the two ways to get to a session worth
            starting. Start is the one thing this screen is for: it sits on the
            brand block, as Finish does in the runner, so a session opens and
            closes on the same card, above the fold on a phone. Fill and label
            swap for the same reason Finish's do: a black button on a black
            card is not a button.

            Another mix and Save were a row of ghost buttons under the card,
            which gave them the same size and weight as Start's. They're
            refinements, so they're glyphs now. Another mix uses the same
            swap arrows as each drill, because it's the same action for the
            whole session. Both get the brand track as a tonal fill, which is
            what .icon-btn's surface-container-low is on a white page. */}
        <div className="mt-5 flex items-center gap-2">
          {/* "Start", no arrow. The headline above already says what's being
              started, and the fill says "press me" — the arrow was standing
              in for a fill when this button was outlined. One word also keeps
              it on one line beside two glyph buttons at phone width. */}
          <Link href={startHref}
                className="btn-primary pressable min-w-0 flex-1 whitespace-nowrap px-4
                           bg-on-surface-brand text-surface-brand">
            Start
          </Link>
          <button onClick={onShuffle} aria-label="Another mix" title="Another mix"
                  className="icon-btn pressable h-[52px] w-[52px] bg-brand-track text-on-surface-brand">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true"
                 stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h13l-3-3M20 16H7l3 3" />
            </svg>
          </button>
          <button onClick={save} disabled={saving === 'saving' || saving === 'saved'}
                  aria-label={saving === 'saved' ? 'Saved to your training' : 'Save to your training'}
                  title={saving === 'saved' ? 'Saved' : 'Save'}
                  className="icon-btn pressable h-[52px] w-[52px] bg-brand-track text-on-surface-brand
                             disabled:cursor-default">
            {/* A bookmark rather than a word: it fills when this session is
                kept, which says Saved without a label to change. */}
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"
                 fill={saving === 'saved' ? 'currentColor' : 'none'}
                 stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
              <path d="M6 4h12v16l-6-4.5L6 20z" />
            </svg>
          </button>
        </div>

        {/* A glyph can't say where the session went or why it didn't go, so
            the outcome is a line of text under the row. role="status" so it's
            announced too, since the button's label alone changes quietly. */}
        <p role="status" className="text-[12.5px] font-medium text-on-surface-brand-variant">
          {saving === 'saved' && (
            <span className="mt-3 block">
              Saved to <Link href="/me" className="font-bold text-on-surface-brand underline underline-offset-4">your training</Link>.
            </span>
          )}
          {saving === 'signin' && (
            <span className="mt-3 block">
              <Link href="/me" className="font-bold text-on-surface-brand underline underline-offset-4">Create an account</Link> to
              save sessions and repeat them.
            </span>
          )}
        </p>
      </div>

      <ol className="stagger mt-6 space-y-2.5">
        {built.drills.map((d, i) => (
          <li key={d.id} className="card p-4">
            <div className="flex items-start gap-3.5">
              <span className="mt-0.5 font-brand text-[13px] font-bold text-on-surface-variant">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="h-card">{d.name}</div>
                <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
                  {d.sets} × {d.reps_time}{d.rest && d.rest !== '-' ? ` · rest ${d.rest}` : ''}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="tag tag-accent">{FOCUS_LABELS[d.primary_focus]}</span>
                  {!!d.touches && <span className="tag tag-accent">{formatTouches(d.touches)} touches</span>}
                  <span className="tag">{d.equipment.join(' · ') || 'no kit'}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-brand text-[15px] font-bold tracking-tighter">
                  {d.total_seconds < 60 ? `${d.total_seconds}s` : `${Math.round(d.total_seconds / 60)}m`}
                </span>
                <div className="flex gap-1.5">
                  {d.video_url && (
                    <a href={d.video_url} target="_blank" rel="noopener" aria-label="Watch demo"
                       className="icon-btn pressable">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </a>
                  )}
                  <button onClick={() => onSwap(i)} aria-label="Swap this drill"
                    className="icon-btn pressable text-on-surface-variant hover:text-on-surface">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"
                         stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M4 8h13l-3-3M20 16H7l3 3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Metric({ v, unit }: { v: string; unit: string }) {
  return (
    <div>
      <div className="font-brand text-[22px] font-bold leading-none tracking-tighter text-on-surface-brand">{v}</div>
      <div className="mt-1 text-[11.5px] font-semibold text-on-surface-brand-variant">{unit}</div>
    </div>
  );
}
