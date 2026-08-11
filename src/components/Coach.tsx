'use client';
import { useState } from 'react';
import { buildSession, swapDrill } from '@/lib/session-builder';
import type { BuiltSession, Exercise, FocusArea, SessionSpec } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';
import { SessionCard } from './SessionCard';

const MINUTES = [10, 15, 20, 30, 45, 60];
const PLACES: [SessionSpec['place'], string][] = [
  ['any', 'Anywhere'], ['home', 'Home'], ['pitch', 'Pitch'], ['gym', 'Gym'],
];

export function Coach({ exercises }: { exercises: Exercise[] }) {
  const [spec, setSpec] = useState<Partial<SessionSpec>>({ place: 'any', level: 'any', priority: 'touches' });
  const [built, setBuilt] = useState<BuiltSession | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');

  const ready = !!spec.minutes && !!spec.focus?.length;

  function build(next = spec) {
    if (!next.minutes || !next.focus?.length) return;
    setBuilt(buildSession(exercises, {
      minutes: next.minutes, focus: next.focus,
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
        setSpec(merged); setReply(data.reply ?? '');
        if (merged.minutes && merged.focus?.length) build(merged);
      }
      setText('');
    } finally { setBusy(false); }
  }

  const toggleFocus = (f: FocusArea) => {
    const cur = spec.focus ?? [];
    setSpec({ ...spec, focus: cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f] });
  };

  return (
    <div className="mt-8">
      {/* the fastest path in */}
      <div className="flex items-center gap-2 rounded-pill border border-line/70 bg-surface
                      p-1.5 pl-5 shadow-card transition focus-within:border-goldUi/60
                      focus-within:shadow-lift">
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="20 minutes, first touch, at home"
          enterKeyHint="go"
          autoCapitalize="none"
          autoCorrect="off"
          // 16px, not 15: anything smaller makes iOS zoom the whole page on focus
          // and never zoom back out.
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] font-medium
                     text-body outline-none placeholder:text-faint"
        />
        <button onClick={ask} disabled={busy}
          className="pressable min-h-11 rounded-pill bg-ink px-5 font-display text-[13.5px]
                     font-bold tracking-tight text-white disabled:opacity-40">
          {busy ? '···' : 'Ask'}
        </button>
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
          {(Object.keys(FOCUS_LABELS) as FocusArea[]).map((f) => (
            <button key={f} onClick={() => toggleFocus(f)}
              className={`chip ${spec.focus?.includes(f) ? 'chip-on' : ''}`}>
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
                className={`chip ${spec.priority === p ? 'chip-gold' : ''}`}>
                {p === 'touches' ? 'Max touches' : 'Balanced'}
              </button>
            ))}
          </Row>
        </div>
      </div>

      <button onClick={() => build()} disabled={!ready} className="btn-gold mt-9 w-full">
        {ready ? 'Build my session' : 'Pick a time and a focus'}
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
