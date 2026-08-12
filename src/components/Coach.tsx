'use client';
import { useEffect, useRef, useState } from 'react';
import { buildSession, swapDrill } from '@/lib/session-builder';
import type { BuiltSession, Exercise, FocusArea, SessionSpec } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';
import { SessionCard } from './SessionCard';

/**
 * Examples are tappable and fill the box rather than rotating inside it.
 *
 * A rotating placeholder could only ever teach — you still had to type. A chip
 * puts a working request one tap away and leaves it editable, which is the
 * difference between "I see what this does" and "I've used it". They stay
 * visible after a build so trying a second angle is also one tap.
 *
 * Deliberately varied, and each is short enough to read as a chip on a phone:
 * no time, time + weakness, a place, time + skill.
 */
const EXAMPLES = [
  'Learn to juggle',
  '15 minutes on my weak foot',
  'Get stronger in the gym',
  '30 minutes of ball mastery',
];

/**
 * The manual rows start open, then fold away the first time the coach builds
 * something — you see the controls exist before they get out of your way.
 * Flip to false to make the chat the only thing on screen at rest.
 */
const MANUAL_OPEN_BY_DEFAULT = true;

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

/** What the collapsed header shows, so folding the rows never hides the answer. */
function summarise(spec: Partial<SessionSpec>, anyFocus: boolean): string {
  const bits: string[] = [];
  if (spec.minutes) bits.push(`${spec.minutes} min`);
  if (anyFocus) bits.push('Anything');
  else if (spec.focus?.length) bits.push(spec.focus.map((f) => FOCUS_LABELS[f]).join(', '));
  if (spec.place && spec.place !== 'any') {
    const place = PLACES.find(([v]) => v === spec.place);
    if (place) bits.push(place[1]);
  }
  return bits.join('  ·  ');
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
  const [manualOpen, setManualOpen] = useState(MANUAL_OPEN_BY_DEFAULT);
  const [pendingScroll, setPendingScroll] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<HTMLDivElement>(null);

  // Runs after the session card is actually in the DOM — on the first build the
  // ref doesn't exist yet at the moment the request resolves.
  useEffect(() => {
    if (!pendingScroll || !built) return;
    setPendingScroll(false);
    const el = sessionRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [pendingScroll, built]);

  const ready = !!spec.minutes && (anyFocus || !!spec.focus?.length);

  /** Returns whether a session was actually built, so callers can react. */
  function build(next = spec, useAny = anyFocus): boolean {
    const focus = useAny ? pickAnyFocus() : next.focus;
    if (!next.minutes || !focus?.length) return false;
    setBuilt(buildSession(exercises, {
      minutes: next.minutes, focus,
      place: next.place ?? 'any', level: next.level ?? 'any',
      priority: next.priority ?? 'touches',
    }));
    return true;
  }

  async function ask() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/coach', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, current: spec }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      if (data.spec) {
        const merged = { ...spec, ...data.spec };
        // Naming a focus out loud overrides "Anything".
        const named = !!data.spec.focus?.length;
        if (named) setAnyFocus(false);
        setSpec(merged); setReply(data.reply ?? '');
        // Fold the rows and travel to the session only when there IS one. A reply
        // that still needs a follow-up leaves the controls where they were.
        if (build(merged, anyFocus && !named)) {
          setManualOpen(false);
          setPendingScroll(true);
        }
      }
      setText('');
    } catch {
      // Previously any failure here threw past the UI and the box just went quiet.
      // Say so, and put the controls back so there is still a way to train.
      setReply('Could not reach the coach just now — set it yourself below and I’ll build it.');
      setManualOpen(true);
    } finally { setBusy(false); }
  }

  function useExample(e: string) {
    setText(e);
    inputRef.current?.focus();
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

  const summary = summarise(spec, anyFocus);

  return (
    <div className="mt-8">
      {/* ---- the coach: the primary way in ---- */}
      {/* Focus is shown by the border alone — no shadow bloom on focus. */}
      <div className="flex items-center gap-2 rounded-pill border-[1.5px] border-line bg-surface
                      p-1.5 pl-5 transition-colors focus-within:border-goldUi">
        <input
          ref={inputRef}
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="What do you want to work on?"
          aria-label="Describe the session you want"
          enterKeyHint="go"
          autoCapitalize="sentences"
          autoCorrect="off"
          // 16px, not 15: anything smaller makes iOS zoom the whole page on focus
          // and never zoom back out.
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] font-medium
                     text-body outline-none placeholder:text-faint"
        />
        {/* Always present now, rather than appearing with the first keystroke: when
            the box is the main event, the thing you press to use it shouldn't be
            something you have to discover. Ink fill, gold label — the same "this is
            an action" signal as btn-primary. */}
        <button onClick={ask} disabled={busy || !text.trim()} aria-label="Build my session"
          className="pressable min-h-11 shrink-0 rounded-pill bg-ink px-6 font-display
                     text-[14px] font-bold tracking-tight text-gold
                     disabled:bg-surface2 disabled:text-muted">
          {busy ? '···' : 'Go'}
        </button>
      </div>

      {/* Directly under the box, where someone deciding what to type is already
          looking. Deliberately short: the page subhead above already asks for time
          and focus, so the only new thing to say is that neither is required. */}
      <p className="mt-3 pl-1 text-[14px] leading-relaxed text-muted">
        Time, skill, place — any of it, or none of it.
      </p>

      {/* One scrolling row, not a wrapped block. Written out as real sentences these
          chips are each a full line wide on a phone, and four stacked rows pushed the
          session controls off the bottom of the screen. Bleeds to the screen edge so
          the fourth chip is visibly cut, which is what says "there is more". */}
      <div className="scroll-x -mx-5 mt-3 flex gap-2 px-5 pb-1">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => useExample(e)}
            className="chip shrink-0 whitespace-nowrap">
            {e}
          </button>
        ))}
      </div>

      {reply && (
        <p key={reply} className="hint-in mt-5 pl-1 text-[14px] font-medium text-body">{reply}</p>
      )}

      {/* ---- manual controls: same power, folded away once the coach answers ---- */}
      <div className="mt-8 border-t border-line pt-5">
        <button
          type="button"
          onClick={() => setManualOpen((o) => !o)}
          aria-expanded={manualOpen}
          aria-controls="manual-controls"
          className="pressable flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="eyebrow block">Or set it yourself</span>
            {/* When folded, the summary is what tells you the coach understood you. */}
            {!manualOpen && summary && (
              <span className="mt-1 block truncate text-[14px] font-semibold text-body">
                {summary}
              </span>
            )}
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true"
               className={`h-5 w-5 shrink-0 text-muted transition-transform duration-200
                           ${manualOpen ? 'rotate-180' : ''}`}
               fill="none" stroke="currentColor" strokeWidth="2.4"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {manualOpen && (
          <div id="manual-controls" className="animate-pop">
            <div className="mt-7 space-y-7">
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
            <button
              onClick={() => { if (build()) setPendingScroll(true); }}
              disabled={!ready}
              className="btn-primary mt-8 w-full"
            >
              {ready ? 'Build my session' : 'Pick what to work on'}
              {ready && (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor"
                     strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {built && (
        <div ref={sessionRef} className="mt-9 scroll-mt-5 animate-pop">
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
