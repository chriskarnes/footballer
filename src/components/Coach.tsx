'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildSession, swapDrill } from '@/lib/session-builder';
import { decodeSession, encodeSession } from '@/lib/session-url';
import type { BuiltSession, Exercise, FocusArea, SessionSpec } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';
import { SessionCard } from './SessionCard';
import { Chip } from './Chip';
import { BackButton } from './BackLink';

/**
 * Only used when someone hits Surprise me without having chosen a time. Nothing
 * is preselected in the rows, but a session still needs a duration, and refusing
 * to answer the one button meant for "I don't know" would defeat it.
 */
const SURPRISE_MINUTES = 20;

const MINUTES = [10, 15, 20, 30, 45];
const PLACES: [SessionSpec['place'], string][] = [
  ['any', 'Anywhere'], ['home', 'Home'], ['pitch', 'Field'], ['gym', 'Gym'],
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
  // Set when a build came back empty. The player stays on the inputs, told why,
  // rather than being taken to a result step with nothing on it.
  const [miss, setMiss] = useState(false);
  // On the result step: a swap or a mix that had nothing else to give.
  const [stuck, setStuck] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  // Whether this visit pushed the result step. If it did, Back is the back
  // gesture. If the session arrived by URL — a refresh, the runner's back link —
  // going back would leave Train altogether, so Back replaces instead.
  const pushed = useRef(false);
  // The result's own top, not the page's: on Train the trainer's week sits
  // above this, and the top of the page is that week, not "Your session".
  const resultRef = useRef<HTMLDivElement>(null);
  const toResult = useRef(false);
  useEffect(() => {
    if (!toResult.current || !resultRef.current) return;
    toResult.current = false;
    window.scrollTo({ top: Math.max(0, resultRef.current.getBoundingClientRect().top + window.scrollY - 16) });
  });

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
      toResult.current = true;
    } else {
      window.history.replaceState(null, '', url);
    }
    return true;
  }

  function change() {
    setStuck(null);
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
      // Say so: the chips above need no network.
      setReply('Couldn’t build that one just now. Pick from the buttons above instead.');
    } finally { setBusy(false); }
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

  if (built) {
    const startHref = `/session/custom?${encodeSession(built, anyFocus)}`;
    return (
      // Keyed on the step, so arriving here plays the same lift-in a new page
      // does. This is the "you made something" moment the old layout lacked.
      <div key="session" ref={resultRef} className="animate-pop">
        <div className="mt-6"><BackButton onClick={change} label="Back" destination="your choices" /></div>
        <section>
          <h1 className="h-page">Your session</h1>
        </section>
        <div className="mt-7">
          <SessionCard built={built} startHref={startHref}
            onSwap={(i) => {
              const next = swapDrill(exercises, built, i);
              if (next === built) { setStuck('Nothing else fits that spot. Try Mix it up.'); return; }
              setStuck(null); show(next, anyFocus, 'replace');
            }}
            onShuffle={() => {
              const next = build();
              if (!next?.drills.length) { setStuck('Nothing else matches. Go back and change your choices.'); return; }
              setStuck(null); show(next, anyFocus, 'replace');
            }} />
        </div>
        {stuck && <p role="status" className="hint-in mt-4 text-center text-body-lg font-semibold text-on-surface">{stuck}</p>}
      </div>
    );
  }

  return (
    <div key="inputs" className="animate-pop">
      {planCard}

      {/* Two questions and a button. Tapping beats typing at ten, so the
          chips lead; the coach box is still here for anyone who'd rather say it. */}
      <div className="mt-8 space-y-8">
        <Row label="How long?">
          {MINUTES.map((m) => (
            <Chip key={m} on={spec.minutes === m} label={`${m} minutes`}
              onClick={() => pick({ ...spec, minutes: m })}>
              {m} min
            </Chip>
          ))}
        </Row>

        <Row label="What do you want to work on?">
          <Chip on={anyFocus} onClick={chooseAny}>Anything</Chip>
          {(Object.keys(FOCUS_LABELS) as FocusArea[]).map((f) => (
            <Chip key={f} on={!anyFocus && !!spec.focus?.includes(f)}
                  onClick={() => toggleFocus(f)}>
              {FOCUS_LABELS[f]}
            </Chip>
          ))}
        </Row>

        <Row label="Where?">
          {PLACES.map(([v, l]) => (
            <Chip key={v} on={spec.place === v}
              onClick={() => pick({ ...spec, place: v })}>{l}</Chip>
          ))}
        </Row>
      </div>

      <button onClick={() => show(build(), anyFocus, 'push')} disabled={!ready}
              className="btn-primary btn-big pressable mt-8 w-full">
        Build my session
      </button>
      {/* For a player who doesn't know what to pick, which at this age is most of them. */}
      <button type="button" onClick={surpriseMe} className="btn-ghost pressable mt-3 min-h-13 w-full text-body-lg font-bold">
        Surprise me
      </button>

      {miss && (
        <p role="status" className="hint-in mt-5 text-center text-body-lg font-semibold text-on-surface">
          Nothing matched. Try a longer session.
        </p>
      )}

      {/* ---- or say it ---- */}
      <div className="mt-10">
        <h2 className="h-sec">Or describe it</h2>
        <div className="mt-3 flex items-center gap-2 rounded-full border border-outline bg-surface-container-lowest
                        p-1.5 pl-5 transition-colors focus-within:border-primary">
          <input
            ref={inputRef}
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="15 minutes on my weak foot"
            aria-label="Describe the session you want"
            enterKeyHint="go"
            autoCapitalize="sentences"
            autoCorrect="off"
            // 16px, not 15: anything smaller makes iOS zoom the whole page on focus.
            className="min-w-0 flex-1 bg-transparent py-2.5 text-title-sm font-medium
                       text-on-surface outline-none placeholder:text-on-surface-variant"
          />
          <button onClick={ask} disabled={busy || !text.trim()}
            aria-label="Build a session from what you typed"
            className="btn-primary btn-sm pressable shrink-0">
            {busy ? '···' : 'Go'}
          </button>
        </div>
        {reply && (
          <p key={reply} className="hint-in mt-4 pl-1 text-body-lg font-medium text-on-surface">{reply}</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="h-sec mb-3">{label}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
