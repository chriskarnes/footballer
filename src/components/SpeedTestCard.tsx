'use client';
import { useEffect, useRef, useState } from 'react';
import { shortDate } from '@/lib/dates';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackButton, BackLink } from './BackLink';
import { ConfirmSheet } from './ConfirmSheet';
import { haptic } from '@/lib/haptics';
import { HEIGHT_TEST, PHASES, PROGRESSION, TESTS, fmtTest } from '@/lib/speed';
import { bests, heightGain, localDay, useSpeedCard, type TestEntry } from '@/lib/speed-card';
import { position } from '@/lib/speed-year';
import { useYearStart } from '@/lib/use-year-start';

/** 2026-11-13 → Nov 13. */
const dayName = shortDate;

type Screen = 'card' | 'entry';

const today = () => localDay();
const fmt = fmtTest;

/**
 * The athlete's card. Reads top to bottom: personal bests, then every test day
 * as a column. Numbers are typed in on test day, kept on the phone and, signed in, on the account (see speed-card.ts).
 *
 * A PB is circled — well, filled — because a teenager will train for a circle.
 */
export function SpeedTestCard() {
  const { entries, ready, add, remove } = useSpeedCard();
  // The step is in the URL, so the back gesture goes from the numbers to the
  // card rather than out of test day.
  const router = useRouter();
  const screen: Screen = useSearchParams().get('step') === 'entry' ? 'entry' : 'card';
  const pushed = useRef(false);
  const setScreen = (to: Screen) => {
    if (to === 'entry') { pushed.current = true; router.push('/speed/test?step=entry', { scroll: false }); }
    else if (pushed.current) { pushed.current = false; router.back(); }
    else router.replace('/speed/test', { scroll: false });
  };
  const [removing, setRemoving] = useState(false);

  if (screen === 'entry') {
    return <Entry onDone={(e) => { add(e); clearDraft(); haptic('success'); setScreen('card'); }}
                  onCancel={() => { clearDraft(); setScreen('card'); }} />;
  }

  const pb = bests(entries);
  const gain = heightGain(entries);
  const last = entries[entries.length - 1];

  return (
    <div className="animate-pop">
      <BackLink href="/speed" label="Speed" />
      <p className="eyebrow mb-2">Test day</p>
      <h1 className="h-page">Your card</h1>
      <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">
        Thursday of every fourth week. Same five tests, same order, same surface, after the
        normal warm-up. Height every time.
      </p>

      <button type="button" onClick={() => { haptic('tap'); setScreen('entry'); }}
              className="btn-primary pressable mt-6 w-full">
        {entries.length ? 'Record today’s tests' : 'Record your first tests'}
      </button>

      {ready && gain !== null && gain > 2.5 && (
        <div className="hint-in mt-5 brand-card p-5">
          <p className="text-body-sm font-bold text-on-surface-brand">Growth spurt: +{gain} cm since last test</p>
          <p className="mt-1.5 text-body-sm leading-relaxed text-on-surface-brand-variant">
            Cut sprint volume by a third, jumping back to Phase 1 level, double the mechanics
            drills for the next 2–3 blocks. Flat or slower times are expected and are not a problem.
          </p>
        </div>
      )}

      {ready && !!entries.length && (
        <section className="mt-8">
          <h2 className="h-sec mb-3">Personal bests</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {TESTS.map((t) => {
              const v = pb[t.id];
              const latest = last?.values[t.id];
              const isPb = v !== undefined && latest === v;
              return (
                <div key={t.id} className={`${isPb ? 'brand-card' : 'card-flat'} p-4`}>
                  <div className={`text-caption font-semibold ${isPb ? 'text-on-surface-brand-variant' : 'text-on-surface-variant'}`}>{t.name}</div>
                  <div className={`mt-1.5 font-brand text-display font-extrabold leading-none tracking-brand-tight ${isPb ? 'text-on-surface-brand' : ''}`}>
                    {v === undefined ? '—' : fmt(v, t.unit)}
                    <span className={`ml-1 text-caption font-bold ${isPb ? 'text-on-surface-brand-variant' : 'text-on-surface-variant'}`}>{t.unit}</span>
                  </div>
                  {isPb && (
                    <div className="mt-1.5 text-label-sm font-bold text-on-surface-brand-variant">
                      {entries.length === 1 ? 'baseline' : 'set last test'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {ready && !!entries.length && (
        <section className="mt-8">
          <h2 className="h-sec mb-3">Every test day</h2>
          <div className="card-flat overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-on-surface-variant">
                  <th className="p-3 font-semibold">Test</th>
                  {entries.map((e) => (
                    <th key={e.date} className="p-3 font-semibold whitespace-nowrap">
                      {shortDate(e.date)}<br /><span className="font-medium">{e.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {[...TESTS, { id: HEIGHT_TEST.id, name: HEIGHT_TEST.name, unit: 'cm' as const, lowerIsBetter: false }].map((t) => (
                  <tr key={t.id}>
                    <td className="p-3 font-semibold whitespace-nowrap">{t.name}</td>
                    {entries.map((e) => {
                      const v = t.id === 'height' ? e.height : e.values[t.id];
                      const isPb = t.id !== 'height' && v !== undefined && v === pb[t.id];
                      return (
                        <td key={e.date} className={`p-3 font-brand tabular-nums ${isPb ? 'font-extrabold text-primary' : 'font-medium'}`}>
                          {v === undefined ? '—' : fmt(v, t.unit)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {last && (
            <button type="button" onClick={() => setRemoving(true)} className="btn-ghost pressable mt-3">
              Delete last test day
            </button>
          )}
          {/* The app's confirmation rather than the browser's, which on a
              phone is a system alert that looks like nothing else here. */}
          <ConfirmSheet open={removing && !!last} title={`Delete the ${last ? dayName(last.date) : ''} test day?`}
            body="Its numbers come off your card and your bests are worked out again without them."
            confirmLabel="Delete" onCancel={() => setRemoving(false)}
            onConfirm={() => { if (last) remove(last.date); setRemoving(false); }} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="h-sec mb-3">The tests</h2>
        <ol className="card-flat divide-y divide-outline-variant">
          {TESTS.map((t, i) => (
            <li key={t.id} className="flex gap-4 p-4">
              <span className="font-brand text-body-sm font-bold text-on-surface-variant">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <div className="h-card">{t.name}</div>
                <div className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">{t.how}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="tag tag-accent">{t.measures}</span>
                  <span className="tag">good block: {t.goodProgress}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-body-sm leading-relaxed text-on-surface-variant">
          Add a 4-minute run (distance on a marked loop) in weeks 4 and 12 of Phases 1 and 2 only.
          Every test day ends with a game: numbers first, fun last.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="h-sec mb-3">What a result changes next block</h2>
        <div className="card-flat divide-y divide-outline-variant">
          {PROGRESSION.map((p) => (
            <div key={p.result} className="p-4">
              <div className="text-body font-bold">{p.result}</div>
              <div className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">{p.change}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** What's typed on the entry screen, kept for this tab until saved or
 *  cancelled, so leaving it by accident doesn't lose the numbers. */
const DRAFT = 'forge.speed.draft';
type Draft = { date: string; phase: (typeof PHASES)[number]["id"]; block: 1 | 2 | 3; vals: Record<string, string>; height: string; note: string };
function readDraft(): Draft | null {
  try { const raw = sessionStorage.getItem(DRAFT); return raw ? JSON.parse(raw) as Draft : null; } catch { return null; }
}
function clearDraft() { try { sessionStorage.removeItem(DRAFT); } catch { /* private mode */ } }

function Entry({ onDone, onCancel }: { onDone: (e: TestEntry) => void; onCancel: () => void }) {
  // Which block this test closes, from the year if one has been started —
  // the athlete shouldn't have to know they're in Build, block 2.
  const { start } = useYearStart();
  const at = start ? position(start) : null;
  const [date, setDate] = useState(today());
  const [phase, setPhase] = useState(PHASES[0].id);
  const [block, setBlock] = useState<1 | 2 | 3>(1);
  const [seeded, setSeeded] = useState(false);
  if (!seeded && at?.state === 'running') {
    setSeeded(true); setPhase(at.phase.id); setBlock(at.block);
  }
  const [vals, setVals] = useState<Record<string, string>>({});
  const [height, setHeight] = useState('');
  const [note, setNote] = useState('');
  // Back to a draft, after mount (the server has no sessionStorage).
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const d = readDraft();
    if (d) { setSeeded(true); setDate(d.date); setPhase(d.phase); setBlock(d.block); setVals(d.vals); setHeight(d.height); setNote(d.note); }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(DRAFT, JSON.stringify({ date, phase, block, vals, height, note })); } catch { /* private mode */ }
  }, [restored, date, phase, block, vals, height, note]);

  const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : undefined; };
  const any = TESTS.some((t) => num(vals[t.id] ?? '') !== undefined) || num(height) !== undefined;

  function save() {
    const values: Record<string, number> = {};
    for (const t of TESTS) { const v = num(vals[t.id] ?? ''); if (v !== undefined) values[t.id] = v; }
    const p = PHASES.find((x) => x.id === phase)!;
    onDone({ date, label: `${p.name} · block ${block}`, values, height: num(height), note: note.trim() || undefined });
  }

  // The app's own .text-field, as the profile and sign-in use: 16px so iOS
  // doesn't zoom on focus. inputMode decimal brings up the number pad with a
  // point on it.
  const field = 'tabular-nums';

  return (
    <div className="animate-pop">
      <BackButton onClick={onCancel} label="Your card" destination="your card" />
      <p className="eyebrow mb-2">Test day</p>
      <h1 className="h-page">Record the numbers</h1>
      <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">
        Best attempt for each. Leave anything you skipped blank.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <label className="text-field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="text-field">
          <span>Block</span>
          <select value={block} onChange={(e) => setBlock(Number(e.target.value) as 1 | 2 | 3)} className={field}>
            <option value={1}>Block 1</option><option value={2}>Block 2</option><option value={3}>Block 3</option>
          </select>
        </label>
        <label className="text-field col-span-2">
          <span>Phase</span>
          <select value={phase} onChange={(e) => setPhase(e.target.value as typeof phase)} className={field}>
            {PHASES.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.name}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-6 space-y-3">
        {TESTS.map((t) => (
          <label key={t.id} className="text-field">
            <span>{t.name} ({t.unit})</span>
            <input inputMode="decimal" placeholder={t.unit === 's' ? '0.00' : '0'}
                   value={vals[t.id] ?? ''} onChange={(e) => setVals({ ...vals, [t.id]: e.target.value })}
                   className={field} />
          </label>
        ))}
        <label className="text-field">
          <span>{HEIGHT_TEST.name} (cm)</span>
          <input inputMode="decimal" placeholder="0" value={height} onChange={(e) => setHeight(e.target.value)} className={field} />
        </label>
        <label className="text-field">
          <span>Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wet grass, late night, new boots…" className={field} />
        </label>
      </div>

      <div className="mt-6 flex gap-2.5">
        <button type="button" onClick={onCancel} className="btn-ghost pressable min-h-13 flex-1">Cancel</button>
        <button type="button" onClick={save} disabled={!any} className="btn-primary pressable flex-1">
          Save to card
        </button>
      </div>
    </div>
  );
}
