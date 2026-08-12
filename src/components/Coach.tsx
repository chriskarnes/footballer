'use client';
import { useEffect, useState } from 'react';
import { buildSession, swapDrill } from '@/lib/session-builder';
import type { BuiltSession, Exercise, FocusArea, SessionSpec } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';
import { SessionCard } from './SessionCard';

/**
 * Rotating examples. Their job is to teach the shape of a good request — that you
 * can give a time, a body part, a place, or none of them — which a single static
 * example can't do.
 *
 * Deliberately varied: one with no time, one with time + weakness, one with a
 * place, one with time + skill.
 */
const EXAMPLES = [
  'I want to learn how to juggle',
  'I have 15 minutes to focus on my weak foot',
  'I need to get stronger in the gym',
  '30 minute session on ball mastery',
];
const ROTATE_MS = 3800;

const MINUTES = [10, 15, 20, 30, 45, 60];
const PLACES: [SessionSpec['place'], string][] = [
  ['any', 'Anywhere'], ['home', 'Home'], ['pitch', 'Pitch'], ['gym', 'Gym'],
];

/**
 * "Anything" — the catch-all for a player who doesn't know what to work on, which
 * at this age is most of them. Previously there was no way past this row without
 * naming a weakness, which is a strange thing to demand of a ten-year-old.
 *
 * It is deliberately NOT all fifteen areas. One drill from each is a scattered
 * session, not a broad one. Three related ball skills gives the session depth, and
 * the three are drawn fresh on every build so "another mix" genuinely differs.
 */
const ANY_POOL: FocusArea[] = [
  'first_touch', 'ball_mastery', 'dribbling', 'passing', 'juggling', 'finishing',
];
function pickAnyFocus(): FocusArea[] {
  const pool = [...ANY_POOL];
  const out: FocusArea[] = [];
  while (out.length < 3 && pool.length) {
    out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return out;
}

export function Coach({ exercises }: { exercises: Exercise[] }) {
  // Minutes default to 20 rather than nothing. Time is a quantity, not a filter —
  // "any" would be meaningless — so the row gets a sensible answer instead of a
  // catch-all, which also leaves "Working on" as the only visibly open question.
  const [spec, setSpec] = useState<Partial<SessionSpec>>({
    minutes: 20, place: 'any', level: 'any', priority: 'touches',
  });
  const [anyFocus, setAnyFocus] = useState(false);
  const [built, setBuilt] = useState<BuiltSession | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [example, setExample] = useState(0);
  const [focused, setFocused] = useState(false);

  // Rotation stops the moment the field is focused or has anything in it. Text
  // changing under someone who is mid-thought is disorienting, and on a phone the
  // keyboard is already covering half the screen.
  const idle = !focused && !text;
  useEffect(() => {
    if (!idle) return;
    const t = setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [idle]);

  const ready = !!spec.minutes && (anyFocus || !!spec.focus?.length);

  function build(next = spec, useAny = anyFocus) {
    const focus = useAny ? pickAnyFocus() : next.focus;
    if (!next.minutes || !focus?.length) return;
    setBuilt(buildSession(exercises, {
      minutes: next.minutes, focus,
      place: next.place ?? 'any', level: next.level ?? 'any',
      priority: next.priority ?? 'touches',
    }));
  }

  async function ask() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/coach', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, current: spec }),
      });
      const data = await r.json();
      if (data.spec) {
        const merged = { ...spec, ...data.spec };
        // Naming a focus out loud overrides "Anything".
        const named = !!data.spec.focus?.length;
        if (named) setAnyFocus(false);
        setSpec(merged); setReply(data.reply ?? '');
        if (merged.minutes && (merged.focus?.length || (anyFocus && !named))) {
          build(merged, anyFocus && !named);
        }
      }
      setText('');
    } finally { setBusy(false); }
  }

  const toggleFocus = (f: FocusArea) => {
    const cur = anyFocus ? [] : (spec.focus ?? []);
    setAnyFocus(false);
    setSpec({ ...spec, focus: cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f] });
  };

  const chooseAny = () => {
    const next = !anyFocus;
    setAnyFocus(next);
    setSpec({ ...spec, focus: [] });
    if (next) build({ ...spec, focus: [] }, true);
  };

  return (
    <div className="mt-8">
      {/* the fastest path in */}
      {/* Focus is shown by the border alone — no shadow bloom on focus. */}
      <div className="flex items-center gap-2 rounded-pill border-[1.5px] border-line bg-surface
                      p-1.5 pl-5 transition-colors focus-within:border-goldUi">
        <div className="relative min-w-0 flex-1">
          <input
            value={text} onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            // The visible hint is the span below, not this attribute — a real
            // placeholder inherits the input's 16px and clips the longer examples
            // on a phone. aria-label keeps a stable accessible name so screen
            // readers aren't handed a field whose description changes every 4s.
            aria-label="Describe the session you want"
            enterKeyHint="go"
            autoCapitalize="none"
            autoCorrect="off"
            // 16px, not 15: anything smaller makes iOS zoom the whole page on focus
            // and never zoom back out.
            className="w-full bg-transparent py-2.5 text-[16px] font-medium
                       text-body outline-none"
          />
          {idle && (
            <span key={example} aria-hidden="true"
              className="hint-in pointer-events-none absolute inset-0 flex items-center pr-1">
              {/* 14.5px, a half-step under the 16px you type at. It buys enough
                  headroom for the longest example to fit a 393px phone with room
                  to spare; on a 320px SE the longest still truncates, which is
                  physics rather than a bug. */}
              <span className="truncate text-[14.5px] font-medium text-faint">
                {EXAMPLES[example]}
              </span>
            </span>
          )}
        </div>
        {/* Only present once there is something to ask. Two reasons: an empty field
            has nothing to submit, and the button was eating ~80px of the bar — which
            is the difference between the longer examples fitting and being cut off
            mid-word. Enter (or "Go" on the phone keyboard) submits either way.
            Ink fill, gold label: the same "this is an action" signal as btn-primary. */}
        {!!text.trim() && (
          <button onClick={ask} disabled={busy}
            className="animate-pop pressable min-h-11 shrink-0 rounded-pill bg-ink px-5 font-display
                       text-[13.5px] font-bold tracking-tight text-gold disabled:opacity-40">
            {busy ? '···' : 'Ask'}
          </button>
        )}
      </div>
      {reply && <p className="mt-3 pl-1 text-[14px] font-medium text-muted">{reply}</p>}

      <div className="mt-9 space-y-7">
        <Row label="How long">
          {MINUTES.map((m) => (
            <button key={m} onClick={() => { const n = { ...spec, minutes: m }; setSpec(n); build(n); }}
              className={`chip ${spec.minutes === m ? 'chip-on' : ''}`}>
              {m}<span className="ml-0.5 opacity-60">min</span>
            </button>
          ))}
        </Row>

        <Row label="Working on">
          {/* Catch-all first, matching "Anywhere" in the row below. */}
          <button onClick={chooseAny} className={`chip ${anyFocus ? 'chip-on' : ''}`}>
            Anything
          </button>
          {(Object.keys(FOCUS_LABELS) as FocusArea[]).map((f) => (
            <button key={f} onClick={() => toggleFocus(f)}
              className={`chip ${!anyFocus && spec.focus?.includes(f) ? 'chip-on' : ''}`}>
              {FOCUS_LABELS[f]}
            </button>
          ))}
        </Row>

        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
          <Row label="Where">
            {PLACES.map(([v, l]) => (
              <button key={v} onClick={() => { const n = { ...spec, place: v }; setSpec(n); build(n); }}
                className={`chip ${spec.place === v ? 'chip-on' : ''}`}>{l}</button>
            ))}
          </Row>
          <Row label="Priority">
            {(['touches', 'balanced'] as const).map((p) => (
              <button key={p} onClick={() => { const n = { ...spec, priority: p }; setSpec(n); build(n); }}
                className={`chip ${spec.priority === p ? 'chip-on' : ''}`}>
                {p === 'touches' ? 'Max touches' : 'Balanced'}
              </button>
            ))}
          </Row>
        </div>
      </div>

      {/* The arrow is doing real work: on a light page a filled block plus a
          direction glyph reads as "press me" faster than colour alone ever did. */}
      <button onClick={() => build()} disabled={!ready} className="btn-primary mt-9 w-full">
        {ready ? 'Build my session' : 'Pick what to work on'}
        {ready && (
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor"
               strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        )}
      </button>

      {built && (
        <div className="mt-9 animate-pop">
          <SessionCard built={built}
            onSwap={(i) => setBuilt(swapDrill(exercises, built, i))}
            onShuffle={() => build()} />
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-3">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
