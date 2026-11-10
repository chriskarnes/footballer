'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buildWeekFor, clearBuiltWeek, saveBuiltSession, savePlan } from '@/app/coach/plan-actions';
import { Chip } from '@/components/Chip';
import { drillTags, type CustomRow, type DrillRow } from '@/lib/academy-week';
import { MINUTE_CHOICES, swapFor, type Target } from '@/lib/week-builder';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const label = (t: string) => FOCUS_LABELS[t as FocusArea] ?? t;

/**
 * One player's plan: how much they train (sessions a week, minutes each),
 * what they work on (up to three tags), and the weeks built from that. A
 * built week replaces their program for that week; each session can have
 * its drills swapped or removed, or move day, and the week can be taken
 * back.
 */
export function PlayerPlan({ userId, first, target, defaults, own, focus: savedFocus, drills, thisWeek, nextWeek, weeks, busy }: {
  userId: string; first: string;
  target: Target; defaults: Target; own: boolean; focus: string[];
  drills: DrillRow[];
  thisWeek: CustomRow[]; nextWeek: CustomRow[];
  /** The Mondays: this week's and next. */
  weeks: { this: string; next: string };
  busy: { club: number[]; game: number | null; meets: number[] };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [sessions, setSessions] = useState(target.sessions);
  const [minutes, setMinutes] = useState(target.minutes);
  const [focus, setFocus] = useState(savedFocus);
  // Drills swapped out, per session, so tapping Swap again moves on.
  const [tried, setTried] = useState<Record<string, string[]>>({});
  const dirty = sessions !== target.sessions || minutes !== target.minutes || focus.join() !== savedFocus.join();

  // Only tags some drill works on: a focus with nothing behind it builds nothing.
  const tags = useMemo(() => {
    const have = new Set(drills.flatMap(drillTags));
    return (Object.keys(FOCUS_LABELS) as FocusArea[]).filter((t) => have.has(t) || focus.includes(t));
  }, [drills, focus]);

  const run = (f: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    setErr('');
    const r = await f();
    if (!r.ok) setErr(r.error ?? 'That didn’t work.'); else router.refresh();
  });

  const save = () => run(() => savePlan(userId, {
    // Same as the academy default and never set: keep following the default.
    sessions: !own && sessions === defaults.sessions ? null : sessions,
    minutes: !own && minutes === defaults.minutes ? null : minutes,
    focus,
  }));

  return (
    <div className="space-y-3">
      <section className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="h-card">How much they train</div>
          <span className="text-[13px] text-on-surface-variant">{sessions * minutes} min a week</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <button type="button" className="icon-btn" aria-label="Fewer sessions" disabled={sessions <= 1} onClick={() => setSessions(sessions - 1)}>−</button>
            <span className="min-w-[7.5rem] text-center text-[15px] font-bold text-on-surface">{sessions} {sessions === 1 ? 'session' : 'sessions'} a week</span>
            <button type="button" className="icon-btn" aria-label="More sessions" disabled={sessions >= 7} onClick={() => setSessions(sessions + 1)}>+</button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Minutes per session">
            {MINUTE_CHOICES.map((m) => <Chip key={m} on={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}
          </div>
        </div>
        {!own && <p className="mt-3 text-[12.5px] text-on-surface-variant">Your default for every player. Change it here for {first} only.</p>}

        <div className="mt-5 flex items-baseline justify-between">
          <div className="text-[14px] font-bold text-on-surface">Work on</div>
          <span className="text-[12.5px] text-on-surface-variant">Up to 3</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => {
            const on = focus.includes(t);
            return (
              <Chip key={t} on={on} onClick={() => setFocus(on ? focus.filter((x) => x !== t) : focus.length < 3 ? [...focus, t] : focus)}>
                {label(t)}
              </Chip>
            );
          })}
          {!tags.length && <p className="text-[13px] text-on-surface-variant">Tag your drills with what they work on, and the tags show up here.</p>}
        </div>

        {dirty && (
          <button type="button" disabled={pending} onClick={save} className="btn-primary pressable mt-5 w-full">
            {pending ? 'Saving…' : 'Save'}
          </button>
        )}
      </section>

      {builtWeek({ title: 'This week', weekOf: weeks.this, rows: thisWeek, which: 'this' })}
      {builtWeek({ title: 'Next week', weekOf: weeks.next, rows: nextWeek, which: 'next' })}
      {err && <p role="alert" className="text-[13px] font-semibold text-on-surface">{err}</p>}
    </div>
  );

  // A plain function, not a component: it's redrawn, never remounted.
  function builtWeek({ title, weekOf, rows, which }: { title: string; weekOf: string; rows: CustomRow[]; which: 'this' | 'next' }) {
    const byId = new Map(drills.map((d) => [d.id, d]));
    const sorted = [...rows].sort((a, b) => a.weekday - b.weekday || a.position - b.position);
    return (
      <section key={which} className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="h-card">{title}</div>
          {rows.length > 0 && (
            <span className="flex gap-4 text-[13px] font-semibold">
              <button type="button" disabled={pending || dirty} onClick={() => run(() => buildWeekFor(userId, which))} className="underline underline-offset-4">Rebuild</button>
              <button type="button" disabled={pending} onClick={() => run(() => clearBuiltWeek(userId, weekOf))} className="text-on-surface-variant underline underline-offset-4">Use their program</button>
            </span>
          )}
        </div>

        {rows.length ? (
          <ol className="mt-3 space-y-3">
            {sorted.map((s) => {
              const total = s.drill_ids.reduce((a, id) => a + (byId.get(id)?.minutes ?? 0), 0);
              const day = s.weekday;
              const note = busy.game === day ? 'Game day' : busy.club.includes(day) || busy.meets.includes(day) ? 'Practice day' : null;
              return (
                <li key={s.id} className="rounded-2xl border border-outline-variant p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-bold text-on-surface">{s.name}</span>
                      <span className="text-[12.5px] text-on-surface-variant">{total} min{note && ` · ${note}`}</span>
                    </span>
                    <select aria-label={`Day for ${s.name}`} value={day} disabled={pending}
                            onChange={(e) => run(() => saveBuiltSession(s.id, { weekday: Number(e.target.value) }))}
                            className="rounded-lg border border-outline bg-surface px-2 py-1.5 text-[13px] font-semibold">
                      {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <ul className="mt-2.5 divide-y divide-outline-variant">
                    {s.drill_ids.map((id, i) => {
                      const d = byId.get(id);
                      return (
                        <li key={`${id}-${i}`} className="flex items-center gap-2 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-on-surface">{d?.name ?? 'Deleted drill'}</span>
                            {d && <span className="block truncate text-[12px] text-on-surface-variant">
                              {[`${d.minutes} min`, drillTags(d).map(label).join(', ')].filter(Boolean).join(' · ')}
                            </span>}
                          </span>
                          <button type="button" disabled={pending} className="shrink-0 text-[12.5px] font-semibold underline underline-offset-4"
                                  onClick={() => {
                                    const gone = [...(tried[s.id] ?? []), id];
                                    const alt = swapFor(drills, s.drill_ids, id, focus, [...gone, ...sorted.flatMap((x) => x.drill_ids)]);
                                    if (!alt) return;
                                    setTried({ ...tried, [s.id]: gone });
                                    run(() => saveBuiltSession(s.id, { drill_ids: s.drill_ids.map((x, k) => k === i ? alt.id : x) }));
                                  }}>Swap</button>
                          {s.drill_ids.length > 1 && (
                            <button type="button" disabled={pending} className="icon-btn" aria-label={`Remove ${d?.name ?? 'drill'}`}
                                    onClick={() => run(() => saveBuiltSession(s.id, { drill_ids: s.drill_ids.filter((_, k) => k !== i) }))}>×</button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-on-surface-variant">
              {which === 'this' ? `${first} is on their program this week.` : 'Not built yet.'} Build it from {sessions} × {minutes} min{focus.length ? `, working on ${focus.map(label).join(', ')}` : ''}.
            </p>
            <button type="button" disabled={pending || dirty} onClick={() => run(() => buildWeekFor(userId, which))}
                    className="btn-ghost pressable mt-4 w-full">
              {pending ? 'Building…' : dirty ? 'Save first' : `Build ${title.toLowerCase()}`}
            </button>
          </>
        )}
      </section>
    );
  }
}
