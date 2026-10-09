'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildSession, swapDrill } from '@/lib/session-builder';
import { decodeSession, encodeSession } from '@/lib/session-url';
import type { BuiltSession, Exercise, FocusArea, SessionSpec } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';
import { SessionCard } from './SessionCard';
import { Chip, CheckIcon } from './Chip';
import { BackButton } from './BackLink';

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

/**
 * Train is two steps on one screen: what you want, then the session that came
 * out of it. They used to be one long page with the session appearing under the
 * form, which never felt like anything had happened — the result was a preview
 * of the inputs, not a thing you'd made and were about to do.
 *
 * The step lives in the URL (see session-url.ts), not in state, so the back
 * gesture leaves the session rather than the app, and a refresh keeps it.
 *
 * useSearchParams has to sit under Suspense or the page can't be prerendered.
 * The fallback is the inputs step with no session — which is what the
 * prerendered page is anyway, since a static render has no query string.
 */
export function Coach({ exercises, planCard }: { exercises: Exercise[]; planCard?: React.ReactNode }) {
  return (
    <Suspense fallback={<Train exercises={exercises} planCard={planCard} params={null} />}>
      <TrainFromUrl exercises={exercises} planCard={planCard} />
    </Suspense>
  );
}

function TrainFromUrl(props: { exercises: Exercise[]; planCard?: React.ReactNode }) {
  return <Train {...props} params={useSearchParams()} />;
}

function Train({
  exercises, planCard, params,
}: {
  exercises: Exercise[];
  /** "Today on your plan" — shown on the questions step only; on the result
   *  step you've already chosen what to do today. */
  planCard?: React.ReactNode;
  params: URLSearchParams | { get(k: string): string | null } | null;
}) {
  const decoded = useMemo(() => (params ? decodeSession(params, exercises) : null), [params, exercises]);
  const built = decoded?.built ?? null;

  // Nothing is preselected. A chip lit before you touched anything claims you
  // chose it, and the summary then reported defaults back to you as if they were
  // your answers. Unset place/level/priority still fall back to 'any' inside
  // build(), so the filters behave the same — they just don't pretend.
  const [spec, setSpec] = useState<Partial<SessionSpec>>({});
  const [anyFocus, setAnyFocus] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);
  // Set when a build came back empty. The player stays on the inputs, told why,
  // rather than being taken to a result step with nothing on it.
  const [miss, setMiss] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  // Whether this visit pushed the result step. If it did, Back is the back
  // gesture. If the session arrived by URL — a refresh, the runner's back link —
  // going back would leave Train altogether, so Back replaces instead.
  const pushed = useRef(false);

  // A session that arrived by URL fills the inputs it came from, so Back lands
  // on a form that describes it rather than an empty one. Only what was actually
  // chosen: the defaults decodeSession fills in would otherwise come back lit,
  // claiming answers nobody gave. A session made here already has its inputs.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !decoded || !params) return;
    seeded.current = true;
    const { spec: s } = decoded.built;
    setAnyFocus(decoded.anyFocus);
    setSpec({
      minutes: s.minutes,
      focus: decoded.anyFocus ? [] : s.focus,
      ...(params.get('p') && { place: s.place }),
      ...(params.get('l') && { level: s.level }),
      ...(params.get('pr') && { priority: s.priority }),
    });
  }, [decoded, params]);

  const ready = !!spec.minutes && (anyFocus || !!spec.focus?.length);

  function build(next = spec, useAny = anyFocus): BuiltSession | null {
    const focus = useAny ? pickAnyFocus() : next.focus;
    if (!next.minutes || !focus?.length) return null;
    return buildSession(exercises, {
      minutes: next.minutes, focus,
      place: next.place ?? 'any', level: next.level ?? 'any',
      priority: next.priority ?? 'touches',
    });
  }

  /**
   * Puts a session in the URL. `push` is the step from inputs to result — a new
   * screen, so a new history entry, and the top of the page. `replace` is a
   * refinement on the result step (a swap, another mix): a back gesture should
   * take you to your choices, not through every mix you passed on.
   */
  function show(b: BuiltSession | null, useAny: boolean, how: 'push' | 'replace'): boolean {
    if (!b) return false;
    if (!b.drills.length) { setMiss(true); return false; }
    setMiss(false);
    seeded.current = true;
    const url = `?${encodeSession(b, useAny)}`;
    if (how === 'push') {
      window.history.pushState(null, '', url);
      pushed.current = true;
      window.scrollTo({ top: 0 });
    } else {
      window.history.replaceState(null, '', url);
    }
    return true;
  }

  function change() {
    if (pushed.current) { pushed.current = false; window.history.back(); }
    else window.history.replaceState(null, '', window.location.pathname);
    window.scrollTo({ top: 0 });
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
        const useAny = anyFocus && !named;
        show(build(merged, useAny), useAny, 'push');
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
    setAnyFocus(false); setMiss(false);
    setSpec({ ...spec, focus: cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f] });
  };

  const chooseAny = () => {
    setAnyFocus(!anyFocus); setMiss(false);
    setSpec({ ...spec, focus: [] });
  };

  /** Chip rows only record the choice now. Building on every tap redrew a
   *  session under the form while you were still filling it in, which is what
   *  made the whole screen feel like browsing — Build is when it gets made. */
  const pick = (n: Partial<SessionSpec>) => { setSpec(n); setMiss(false); };

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
    show(build(next, true), true, 'push');
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

  if (built) {
    const startHref = `/session/custom?${encodeSession(built, anyFocus)}`;
    return (
      // Keyed on the step, so arriving here plays the same lift-in a new page
      // does. This is the "you made something" moment the old layout lacked.
      <div key="session" className="animate-pop">
        <div className="mt-6"><BackButton onClick={change} label="Back" destination="your choices" /></div>
        <section>
          <h1 className="h-hero">Your {built.spec.minutes}-minute session</h1>
          {/* What the coach said, if you asked it — it's describing this. */}
          {reply && (
            <p className="mt-3 text-[15px] leading-relaxed text-on-surface-variant">{reply}</p>
          )}
        </section>
        <div className="mt-7">
          <SessionCard built={built} startHref={startHref}
            onSwap={(i) => show(swapDrill(exercises, built, i), anyFocus, 'replace')}
            onShuffle={() => show(build(), anyFocus, 'replace')} />
        </div>
      </div>
    );
  }

  return (
    <div key="inputs" className="animate-pop">
      {/* No "Train now" kicker: the headline says it and the tab you arrived on
          is called Train. */}
      <section className="hero">
        <h1 className="h-hero">Start training now</h1>
      </section>

      {planCard}

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
      {/* `outline`, not `outline-variant`: 1.69:1 is a decorative edge, and
          this is the edge of the main control on the screen. Same border
          every other field and pill on the site draws. */}
      <div className="mt-5 flex items-center gap-2 rounded-full border border-outline bg-surface-container-lowest
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
            something you have to discover. */}
        {/* The accessible name has to say what "Go" does, and it has to differ from
            the manual Build button below — two controls sharing one name is a maze
            for anyone navigating by voice or screen reader. */}
        {/* A small primary button, because it is the primary action on the
            screen. It had been a bespoke 2px-ringed pill, which under THE RULE
            is the mark of something you have chosen — the one control on Train
            that most needed to say "press me" was wearing the "selected" ring.
            btn-primary's own :disabled handles the empty state: outlined, muted
            label, boundary at 4.5:1. */}
        <button onClick={ask} disabled={busy || !text.trim()}
          aria-label="Build a session from what you typed"
          className="btn-primary btn-sm pressable shrink-0">
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
                    onClick={() => pick({ ...spec, minutes: m })}>
                    {m} min
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
                      onClick={() => pick({ ...spec, place: v })}>{l}</Chip>
                  ))}
                </Row>
                <Row label="Priority">
                  {(['touches', 'balanced'] as const).map((p) => (
                    <Chip key={p} on={spec.priority === p}
                      onClick={() => pick({ ...spec, priority: p })}>
                      {p === 'touches' ? 'Max touches' : 'Balanced'}
                    </Chip>
                  ))}
                </Row>
              </div>
            </div>

        {/* btn-primary, which is outlined now — see THE RULE in globals.css.
            The arrow does the work the fill used to: a direction glyph says
            "press me" without claiming to be a thing that has been chosen. */}
        <button
          onClick={() => show(build(), anyFocus, 'push')}
          disabled={!ready}
          className="btn-primary pressable mt-8 w-full"
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

      {/* Outside both panels: either route can come back empty. */}
      {miss && (
        <p role="status" className="hint-in mt-5 pl-1 text-[14px] font-medium text-on-surface">
          Nothing matched — try a longer session or a different place.
        </p>
      )}
      </div>
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
