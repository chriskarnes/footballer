'use client';
import { offline } from '@/lib/plain-error';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buildWeekFor, saveBuiltSession, savePlan, setMode } from '@/app/coach/plan-actions';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useToast } from './Toast';
import { drillTags, type CustomRow, type DrillRow, type TeamDays } from '@/lib/academy-week';
import { MAX_STEP, MINUTE_CHOICES, progressAmount, swapFor, type Target } from '@/lib/week-builder';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const label = (t: string) => FOCUS_LABELS[t as FocusArea] ?? t;
const FEEL = { easy: 'felt too easy', right: 'felt about right', hard: 'felt too hard' } as const;
/** What happened to a drill against last week. */
const CHANGE: Record<string, string> = { up: 'Level up', harder: 'Next drill', hold: 'Same level' };
/** Levels past the first a trainer can set by hand. */
const TOP_STEP = MAX_STEP + 3;

type Mode = 'program' | 'custom' | 'auto';

/**
 * How one player's week is set, as one choice:
 *   - Program: their group's program, or their own (the `program` slot);
 *   - Custom: weeks built from how much they train and what they work on.
 *     Each session's drills can be swapped, removed or set to a level, and
 *     its day moved.
 */
export function PlayerPlan({ userId, first, mode, program, target, defaults, own, focus: savedFocus, progress: savedProgress, ownProgress,
  drills, thisWeek, nextWeek, weeks, busy, runs = {} }: {
  userId: string; first: string;
  mode: Mode;
  /** What Program shows: this week, groups and their own programs. */
  program: React.ReactNode;
  target: Target; defaults: Target & { progress: boolean }; own: boolean; focus: string[];
  /** Whether their custom weeks level up, and their own setting (null: the academy's). */
  progress: boolean; ownProgress: boolean | null;
  drills: DrillRow[];
  thisWeek: CustomRow[]; nextWeek: CustomRow[];
  /** The Mondays: this week's and next. */
  weeks: { this: string; next: string };
  busy: TeamDays & { meets: number[] };
  /** Custom sessions they've done, by id, with how it felt. */
  runs?: Record<string, { feel: 'easy' | 'right' | 'hard' | null }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  // Where the error belongs: a session's id, `week:this|next`, or null (the
  // settings above). Drawn there, not at the foot of both weeks.
  const [errAt, setErrAt] = useState<string | null>(null);
  const fault = (text: string, at: string | null = null) => { setErr(text); setErrAt(at); };
  // Why the last build skipped the AI, when it did.
  const [why, setWhy] = useState('');
  const [sessions, setSessions] = useState(target.sessions);
  const [minutes, setMinutes] = useState(target.minutes);
  const [focus, setFocus] = useState(savedFocus);
  const [progress, setProgress] = useState(savedProgress);
  const [confirm, setConfirm] = useState(false);
  // Rebuilding replaces the week, including anything changed by hand: asked first.
  const [rebuild, setRebuild] = useState<'this' | 'next' | null>(null);
  const toast = useToast();
  // The drill row open for editing, as "session:index".
  const [open, setOpen] = useState('');
  // Drills swapped out, per session, so tapping Swap again moves on.
  const [tried, setTried] = useState<Record<string, string[]>>({});
  const dirty = sessions !== target.sessions || minutes !== target.minutes || focus.join() !== savedFocus.join() || progress !== savedProgress;
  const ownSettings = own || ownProgress !== null;

  // Only tags some drill works on: a focus with nothing behind it builds nothing.
  const tags = useMemo(() => {
    const have = new Set(drills.flatMap(drillTags));
    return (Object.keys(FOCUS_LABELS) as FocusArea[]).filter((t) => have.has(t) || focus.includes(t));
  }, [drills, focus]);

  // `close` runs either way: a confirm sheet left open on failure would hide
  // the error, which is drawn on the page behind it.
  const run = (f: () => Promise<{ ok: boolean; error?: string; why?: string }>, after?: () => void, said = 'Saved.', close?: () => void, at: string | null = null) => start(async () => {
    setErr('');
    const r = await f().catch(offline);
    close?.();
    if (!r.ok) fault(r.error ?? 'That didn’t work.', at);
    else { if ('why' in r) setWhy(r.why ?? ''); after?.(); toast(said); router.refresh(); }
  });

  const save = () => run(() => savePlan(userId, {
    // Same as the academy default and never set: keep following the default.
    sessions: !own && sessions === defaults.sessions ? null : sessions,
    minutes: !own && minutes === defaults.minutes ? null : minutes,
    focus,
    // Sent only when changed; back to the academy's setting when it matches it.
    ...(progress !== savedProgress ? { progress: progress === defaults.progress ? null : progress } : {}),
  }), undefined, 'Saved.', undefined, 'settings');

  const resetToDefaults = () => run(() => savePlan(userId, { sessions: null, minutes: null, focus: savedFocus, progress: null }), () => {
    setSessions(defaults.sessions); setMinutes(defaults.minutes); setProgress(defaults.progress);
  }, 'Saved.', undefined, 'settings');

  const choose = (m: 'program' | 'custom') => {
    if (m === mode) return;
    if (m === 'program' && (thisWeek.length || nextWeek.length)) { setConfirm(true); return; }
    run(() => setMode(userId, m));
  };

  const OPTIONS = [
    { key: 'program', title: 'Program', line: 'Their group’s program, or one of their own.' },
    { key: 'custom', title: 'Custom weeks', line: 'Built from how much they train and what they work on. Edit any session.' },
  ] as const;

  return (
    <div className="space-y-3">
      <div role="group" aria-label={`How ${first}’s week is set`} className="grid grid-cols-2 gap-2.5">
        {OPTIONS.map((o) => {
          const on = o.key === 'custom' ? mode !== 'program' : mode === 'program';
          return (
            <button key={o.key} type="button" aria-pressed={on} disabled={pending} onClick={() => choose(o.key)}
                    className={`pressable rounded-large border p-3.5 text-left transition-colors
                      ${on ? 'border-on-surface bg-surface-container-high' : 'border-outline-variant'}`}>
              <span className="block text-body-lg font-bold text-on-surface">{o.title}</span>
              <span className="mt-0.5 block text-body-sm leading-snug text-on-surface-variant">{o.line}</span>
            </button>
          );
        })}
      </div>

      {mode === 'program' ? program : (
        <>
          <section className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="h-card">How much they train</div>
              <span className="text-body text-on-surface-variant">{sessions * minutes} min a week</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <button type="button" className="icon-btn" aria-label="Fewer sessions" disabled={sessions <= 1} onClick={() => setSessions(sessions - 1)}>−</button>
                <span className="min-w-[7.5rem] text-center text-body-lg font-bold text-on-surface">{sessions} {sessions === 1 ? 'session' : 'sessions'} a week</span>
                <button type="button" className="icon-btn" aria-label="More sessions" disabled={sessions >= 7} onClick={() => setSessions(sessions + 1)}>+</button>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Minutes per session">
                {MINUTE_CHOICES.map((m) => <Chip key={m} on={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}
              </div>
            </div>

            <div className="mt-5 flex items-baseline justify-between">
              <div className="text-body font-bold text-on-surface">Work on</div>
              <span className="text-body-sm text-on-surface-variant">Up to 3</span>
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
              {!tags.length && <p className="text-body text-on-surface-variant">Tag your drills with what they work on, and the tags show up here.</p>}
            </div>

            <label className="mt-5 flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="block text-body font-bold text-on-surface">Level up week to week</span>
                <span className="mt-0.5 block text-body-sm leading-snug text-on-surface-variant">
                  {progress
                    ? 'Drills they handle go up a level each week, with a lighter week every fourth.'
                    : 'Every drill stays at its own amount. You set levels yourself.'}
                </span>
              </span>
              <input type="checkbox" role="switch" className="mt-1 h-5 w-5 shrink-0 accent-current" checked={progress}
                     onChange={(e) => setProgress(e.target.checked)} />
            </label>

            <p className="mt-4 text-body-sm text-on-surface-variant">
              {ownSettings ? <>Just for {first}. <button type="button" disabled={pending} onClick={resetToDefaults}
                className="font-semibold text-on-surface underline underline-offset-4">Use academy defaults</button></>
                : `Academy defaults. Changes here are just for ${first}.`}
            </p>

            {dirty && (
              <button type="button" disabled={pending} onClick={save} className="btn-primary pressable mt-5 w-full">
                {pending ? 'Saving…' : 'Save'}
              </button>
            )}
            {/* Here, by Save: below the two weeks it was out of sight. */}
            {err && errAt === 'settings' && <p role="alert" className="mt-2.5 text-body font-semibold text-on-surface">{err}</p>}
          </section>

          {customWeek({ title: 'This week', rows: thisWeek, which: 'this' })}
          {customWeek({ title: 'Next week', rows: nextWeek, which: 'next' })}
        </>
      )}
      {why && <p role="status" className="text-body-sm text-on-surface-variant">{why}.</p>}
      {err && !errAt && <p role="alert" className="text-body font-semibold text-on-surface">{err}</p>}

      <ConfirmSheet open={confirm} title="Back to their program?" confirmLabel="Back to program" busy={pending}
        body={`${first}’s custom weeks from this week on are taken away, apart from sessions they’ve already done, and their program is their week again.`}
        onCancel={() => setConfirm(false)}
        onConfirm={() => run(() => setMode(userId, 'program'), undefined, 'Saved.', () => setConfirm(false))} />
      <ConfirmSheet open={!!rebuild} title={`Rebuild ${rebuild === 'next' ? 'next' : 'this'} week?`} confirmLabel="Rebuild" busy={pending}
        body={`${first}’s sessions for that week are built again from their settings. Any drills you changed by hand are replaced; sessions they’ve done stay done.`}
        onCancel={() => setRebuild(null)}
        onConfirm={() => rebuild && run(() => buildWeekFor(userId, rebuild), undefined, 'Week rebuilt.', () => setRebuild(null), `week:${rebuild}`)} />
    </div>
  );

  // A plain function, not a component: it's redrawn, never remounted.
  function customWeek({ title, rows, which }: { title: string; rows: CustomRow[]; which: 'this' | 'next' }) {
    const byId = new Map(drills.map((d) => [d.id, d]));
    const sorted = [...rows].sort((a, b) => a.weekday - b.weekday || a.position - b.position);
    const tagsOf = [rows.some((r) => r.made_by === 'ai') && 'AI', rows.some((r) => r.made_by === 'trainer') && 'Edited', rows.some((r) => r.light) && 'Lighter week']
      .filter((x): x is string => !!x);
    return (
      <section key={which} className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="h-card">{title}</div>
            {tagsOf.map((t) => (
              <span key={t} className="rounded-full bg-surface-container-highest px-2 py-0.5 text-label-sm font-bold text-on-surface-variant">{t}</span>
            ))}
          </div>
          {rows.length > 0 && (
            <button type="button" disabled={pending || dirty} onClick={() => setRebuild(which)}
                    className="shrink-0 text-body font-semibold underline underline-offset-4 disabled:no-underline disabled:text-on-surface-variant">
              {dirty ? 'Save first to rebuild' : 'Rebuild'}
            </button>
          )}
        </div>

        {rows.length ? (
          <ol className="mt-3 space-y-3">
            {sorted.map((s) => {
              const total = s.drill_ids.reduce((a, id) => a + (byId.get(id)?.minutes ?? 0), 0);
              const day = s.weekday;
              const note = busy.games.includes(day) ? 'Game day' : busy.trainer.includes(day) ? 'Trainer day'
                : busy.practice.includes(day) ? 'Practice day' : busy.meets.includes(day) ? 'Trainer day' : null;
              const ran = runs[s.id];
              return (
                <li key={s.id} className="rounded-large border border-outline-variant p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-body-lg font-bold text-on-surface">{s.name}</span>
                      <span className="text-body-sm text-on-surface-variant">{total} min{note && ` · ${note}`}</span>
                      {ran && (
                        <span className="mt-0.5 block text-body-sm font-semibold text-on-surface">
                          Done{ran.feel ? `, ${FEEL[ran.feel]}` : ''}
                        </span>
                      )}
                      {s.note && <span className="mt-1 block text-body-sm italic leading-snug text-on-surface">“{s.note}”</span>}
                    </span>
                    <select aria-label={`Day for ${s.name}`} value={day} disabled={pending}
                            onChange={(e) => run(() => saveBuiltSession(s.id, { weekday: Number(e.target.value) }), undefined, 'Saved.', undefined, s.id)}
                            className="h-11 rounded-small border border-outline bg-surface px-3 text-body font-semibold">
                      {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <ul className="mt-2.5 divide-y divide-outline-variant">
                    {s.drill_ids.map((id, i) => drillRow(s, sorted, id, i, byId.get(id)))}
                  </ul>
                  {err && errAt === s.id && <p role="alert" className="mt-2.5 text-body font-semibold text-on-surface">{err}</p>}
                </li>
              );
            })}
          </ol>
        ) : (
          <>
            <p className="mt-1 text-body text-on-surface-variant">
              {which === 'this' ? `Not built yet, so ${first} is on their program this week.` : 'Not built yet.'} Build it from {sessions} × {minutes} min{focus.length ? `, working on ${focus.map(label).join(', ')}` : ''}.
            </p>
            <button type="button" disabled={pending || dirty} onClick={() => run(() => buildWeekFor(userId, which), undefined, 'Week built.', undefined, `week:${which}`)}
                    className="btn-ghost pressable mt-4 w-full">
              {pending ? 'Building…' : dirty ? 'Save first' : `Build ${title.toLowerCase()}`}
            </button>
          </>
        )}
        {err && errAt === `week:${which}` && <p role="alert" className="mt-2.5 text-body font-semibold text-on-surface">{err}</p>}
      </section>
    );
  }

  // One drill in a custom session. Tap it for its level, Swap and Remove.
  function drillRow(s: CustomRow, sorted: CustomRow[], id: string, i: number, d: DrillRow | undefined) {
    const key = `${s.id}:${i}`;
    const isOpen = open === key;
    const step = s.steps?.[i] ?? 0;
    const change = CHANGE[s.changes?.[i] ?? ''];
    const save = (drill_ids: string[], steps: number[], changes: string[]) =>
      run(() => saveBuiltSession(s.id, { drill_ids, steps, changes }), undefined, 'Saved.', undefined, s.id);
    const steps = s.drill_ids.map((_, k) => s.steps?.[k] ?? 0);
    const changes = s.drill_ids.map((_, k) => s.changes?.[k] ?? 'new');
    // Set by hand: the trainer's level, no label.
    const setLevel = (n: number) => save(s.drill_ids, steps.map((x, k) => k === i ? n : x), changes.map((c, k) => k === i ? 'same' : c));

    return (
      <li key={`${id}-${i}`} className="py-2">
        <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : key)} className="block w-full text-left">
          <span className="flex items-center gap-2">
            <span className="truncate text-body font-semibold text-on-surface">{d?.name ?? 'Deleted drill'}</span>
            {change && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-label-sm font-bold
                ${s.changes![i] === 'hold' ? 'bg-surface-container-highest text-on-surface-variant' : 'bg-on-surface text-surface'}`}>{change}</span>
            )}
            <span aria-hidden className="ml-auto shrink-0 text-caption text-on-surface-variant">{isOpen ? '▴' : '▾'}</span>
          </span>
          {d && <span className="block truncate text-caption text-on-surface-variant">
            {[progressAmount(d.amount, step), `${d.minutes} min`, drillTags(d).map(label).join(', ')].filter(Boolean).join(' · ')}
          </span>}
        </button>
        {isOpen && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            {d?.amount && (
              <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                <button type="button" className="icon-btn" aria-label={`Level down ${d.name}`}
                        disabled={pending || step <= 0} onClick={() => setLevel(step - 1)}>−</button>
                <span className="min-w-[3.5rem] text-center font-semibold text-on-surface">Level {step + 1}</span>
                <button type="button" className="icon-btn" aria-label={`Level up ${d.name}`}
                        disabled={pending || step >= TOP_STEP} onClick={() => setLevel(step + 1)}>+</button>
              </span>
            )}
            <button type="button" disabled={pending} className="text-body-sm font-semibold underline underline-offset-4"
                    onClick={() => {
                      const gone = [...(tried[s.id] ?? []), id];
                      const alt = swapFor(drills, s.drill_ids, id, focus, [...gone, ...sorted.flatMap((x) => x.drill_ids)]);
                      if (!alt) { fault('No other drill to swap in.', s.id); return; }
                      setTried({ ...tried, [s.id]: gone });
                      save(s.drill_ids.map((x, k) => k === i ? alt.id : x), steps.map((x, k) => k === i ? 0 : x), changes.map((c, k) => k === i ? 'new' : c));
                    }}>Swap</button>
            {s.drill_ids.length > 1 && (
              <button type="button" disabled={pending} className="text-body-sm font-semibold text-on-surface-variant underline underline-offset-4"
                      onClick={() => {
                        setOpen('');
                        save(s.drill_ids.filter((_, k) => k !== i), steps.filter((_, k) => k !== i), changes.filter((_, k) => k !== i));
                      }}>Remove</button>
            )}
          </div>
        )}
      </li>
    );
  }
}
