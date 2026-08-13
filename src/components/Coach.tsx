'use client';
import { useEffect, useRef, useState } from 'react';
import { buildSession, swapDrill } from '@/lib/session-builder';
import type { BuiltSession, Exercise, FocusArea, SessionSpec } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';
import { SessionCard } from './SessionCard';
import { Chip, CheckIcon } from './Chip';

/**
 * Examples are tappable, but they are set as running subtext rather than chips.
 * A chip in this design system means "CHOOSE one of these" (see globals.css) and
 * every real chip on this screen is a filter. Styling an autofill shortcut the
 * same way made two unrelated things look like one control group.
 *
 * Deliberately varied: no time, time + weakness, a place, time + skill.
 */
const EXAMPLES = [
  'Learn to juggle',
  '15 minutes on my weak foot',
  'Get stronger in the gym',
  '30 minutes of ball mastery',
];

/**
 * Which mode Train opens in. The coach every time is right for a new player and
 * friction for someone who always builds by hand — see the open question about
 * remembering the last mode. Until that's decided, a first-time-correct default
 * beats a remembered one.
 */
const DEFAULT_MODE: Mode = 'ai';

type Mode = 'ai' | 'diy';

/**
 * Only used when someone hits Surprise me without having chosen a time. Nothing
 * is preselected in the rows, but a session still needs a duration, and refusing
 * to answer the one button meant for "I don't know" would defeat it.
 */
const SURPRISE_MINUTES = 20;

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

const MODES: [Mode, string][] = [['ai', 'Ask the coach'], ['diy', 'Build it myself']];

export function Coach({ exercises }: { exercises: Exercise[] }) {
  // Nothing is preselected. A chip lit before you touched anything claims you
  // chose it, and the summary then reported defaults back to you as if they were
  // your answers. Unset place/level/priority still fall back to 'any' inside
  // build(), so the filters behave the same — they just don't pretend.
  const [spec, setSpec] = useState<Partial<SessionSpec>>({});
  const [anyFocus, setAnyFocus] = useState(false);
  const [built, setBuilt] = useState<BuiltSession | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);
  const [pendingScroll, setPendingScroll] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);

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
        // Travel to the session only when there IS one. A reply that still needs
        // a follow-up leaves you where you were, with the box still in reach.
        if (build(merged, anyFocus && !named)) setPendingScroll(true);
      }
      setText('');
    } catch {
      // Previously any failure here threw past the UI and the box just went quiet.
      // Say so, and hand over the mode that doesn't need the network — everything
      // typed here survives the switch, so nothing is lost by taking it.
      setReply('Could not reach the coach just now — build it yourself and I’ll put it together.');
      setMode('diy');
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

  /**
   * Randomises what you work on, not how long for. Time is the one thing the
   * player actually knows — a surprise 45 minutes when you have 15 is not a
   * surprise, it's a wrong answer. Whatever is in "How long" is kept.
   */
  function surpriseMe() {
    // Writes the fallback duration into the spec rather than only into the build,
    // so "How long" shows the time the session was actually cut to.
    const next = { ...spec, minutes: spec.minutes ?? SURPRISE_MINUTES, focus: [] };
    setAnyFocus(true);
    setSpec(next);
    if (build(next, true)) setPendingScroll(true);
  }

  /** Roving focus across the two segments, which is what `role="tab"` promises. */
  function onTablistKey(e: React.KeyboardEvent) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const next: Mode =
      e.key === 'Home' ? 'ai'
      : e.key === 'End' ? 'diy'
      : mode === 'ai' ? 'diy' : 'ai';
    setMode(next);
    const i = MODES.findIndex(([m]) => m === next);
    (tablistRef.current?.children[i] as HTMLElement | undefined)?.focus();
  }

  return (
    <div className="mt-8">
      {/* ---- mode switch ----
          Two inputs to one output, not two steps. Stacked, the form read as the
          fallback for the coach having failed. The session below belongs to
          neither panel, which is why it sits outside both. */}
      <div ref={tablistRef} onKeyDown={onTablistKey} className="segmented"
           role="tablist" aria-label="How to build your session">
        {MODES.map(([m, label]) => (
          <button key={m} role="tab" id={`tab-${m}`} aria-controls={`panel-${m}`}
                  aria-selected={mode === m} tabIndex={mode === m ? 0 : -1}
                  onClick={() => setMode(m)}
                  className={`segment pressable ${mode === m ? 'segment-on' : ''}`}>
            <CheckIcon className="seg-check" />
            {label}
          </button>
        ))}
      </div>

      {/* ---- the coach ---- */}
      {/* `hidden`, not unmounted: what you typed in one mode survives a trip to
          the other, and a half-filled form is worth more than a clean remount. */}
      <div id="panel-ai" role="tabpanel" aria-labelledby="tab-ai" hidden={mode !== 'ai'}>
      <p className="mt-5 text-[15px] leading-relaxed text-on-surface-variant">
        Tell me what you want to work on and how much time you have and I&rsquo;ll build a
        session instantly.
      </p>

      {/* Focus is shown by the border alone — no shadow bloom on focus. */}
      <div className="mt-5 flex items-center gap-2 rounded-full border-[1.5px] border-outline-variant bg-surface-container-lowest
                      p-1.5 pl-5 transition-colors focus-within:border-primary">
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
                     text-on-surface outline-none placeholder:text-on-surface-variant"
        />
        {/* Always present now, rather than appearing with the first keystroke: when
            the box is the main event, the thing you press to use it shouldn't be
            something you have to discover. Ink fill, gold label — the same "this is
            an action" signal as btn-primary. */}
        {/* The accessible name has to say what "Go" does, and it has to differ from
            the manual Build button below — two controls sharing one name is a maze
            for anyone navigating by voice or screen reader. */}
        <button onClick={ask} disabled={busy || !text.trim()}
          aria-label="Build a session from what you typed"
          className="pressable min-h-11 shrink-0 rounded-full bg-inverse-surface px-6 font-brand
                     text-[14px] font-bold tracking-tight text-inverse-primary
                     disabled:bg-surface-container-low disabled:text-on-surface-variant">
          {busy ? '···' : 'Go'}
        </button>
      </div>

      {/* Subtext, directly under the box that it fills. leading-loose is doing
          accessibility work, not decoration: when these wrap on a phone it keeps
          each tappable phrase a clear thumb-width away from the one above it. */}
      <p className="mt-3 pl-1 text-[14px] leading-loose text-on-surface-variant">
        Try{' '}
        {EXAMPLES.map((e, i) => (
          <span key={e}>
            {i === EXAMPLES.length - 1 && 'or '}
            {/* Muted like the sentence it sits in — the underline is what says
                "tappable", not weight or colour. Semibold plus body ink turned four
                shortcuts into four headlines competing with the box above them. */}
            <button type="button" onClick={() => useExample(e)}
              className="font-semibold underline decoration-outline decoration-2
                         underline-offset-4 transition-colors hover:text-on-surface
                         hover:decoration-primary">
              {e}
            </button>
            {i < EXAMPLES.length - 1 ? ', ' : '.'}
          </span>
        ))}
      </p>

      {/* The way in for a player who genuinely doesn't know — which at this age is
          most of them. It sits inside this panel as a secondary action: as a peer
          of the coach box it read as a third route through the screen. btn-ghost
          because the design system reserves the bordered block for the lesser of
          two actions, and Go is the greater one. */}
      <button type="button" onClick={surpriseMe} className="btn-ghost mt-4">
        Surprise me
      </button>

      {reply && (
        <p key={reply} className="hint-in mt-5 pl-1 text-[14px] font-medium text-on-surface">{reply}</p>
      )}
      </div>

      {/* ---- build it yourself: the same power, asked for directly ---- */}
      <div id="panel-diy" role="tabpanel" aria-labelledby="tab-diy" hidden={mode !== 'diy'}>
        <p className="mt-5 text-[15px] leading-relaxed text-on-surface-variant">
          Pick your time and what you want to work on. Everything else is optional.
        </p>

            <div className="mt-7 space-y-7">
              <Row label="How long">
                {MINUTES.map((m) => (
                  <Chip key={m} on={spec.minutes === m} label={`${m} minutes`}
                    onClick={() => { const n = { ...spec, minutes: m }; setSpec(n); build(n); }}>
                    {m}<span className="ml-0.5 opacity-60">min</span>
                  </Chip>
                ))}
              </Row>

              <Row label="Working on">
                {/* Catch-all first, matching "Anywhere" in the row below. */}
                <Chip on={anyFocus} onClick={chooseAny}>Anything</Chip>
                {(Object.keys(FOCUS_LABELS) as FocusArea[]).map((f) => (
                  <Chip key={f} on={!anyFocus && !!spec.focus?.includes(f)}
                        onClick={() => toggleFocus(f)}>
                    {FOCUS_LABELS[f]}
                  </Chip>
                ))}
              </Row>

              <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
                <Row label="Where">
                  {PLACES.map(([v, l]) => (
                    <Chip key={v} on={spec.place === v}
                      onClick={() => { const n = { ...spec, place: v }; setSpec(n); build(n); }}>{l}</Chip>
                  ))}
                </Row>
                <Row label="Priority">
                  {(['touches', 'balanced'] as const).map((p) => (
                    <Chip key={p} on={spec.priority === p}
                      onClick={() => { const n = { ...spec, priority: p }; setSpec(n); build(n); }}>
                      {p === 'touches' ? 'Max touches' : 'Balanced'}
                    </Chip>
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
          Build
          {ready && (
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor"
                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>

      {/* Outside both panels, deliberately: switching mode must not clear a
          session you already have. It belongs to neither input. */}
      {built && (
        <div ref={sessionRef} className="mt-10 scroll-mt-5 animate-pop">
          <h2 className="h-card mb-3.5">Your session</h2>
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
