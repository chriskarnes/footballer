'use client';
import { useId, useState } from 'react';
import { CheckIcon } from '@/components/Chip';

const MODES = [['pick', 'From your sessions'], ['build', 'Build a new one']] as const;
type Mode = (typeof MODES)[number][0];

/**
 * Two ways to put a session in a program week, one on screen at a time: tick
 * ones already made, or build a new one. They used to sit one above the
 * other, and the new session's drill list read as more sessions to pick.
 *
 * Tabs, with a tablist's keys: Tab reaches the chosen one, the arrows (and
 * Home and End) move between them and switch as they go.
 */
export function AddToWeek({ pick, build }: { pick: React.ReactNode; build: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('pick');
  const id = useId();

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = MODES.findIndex(([m]) => m === mode);
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % MODES.length
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + MODES.length) % MODES.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? MODES.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setMode(MODES[next][0]);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  }

  return (
    <>
      <div className="segmented max-w-md" role="tablist" aria-label="How to add a session" onKeyDown={onKey}>
        {MODES.map(([m, label]) => (
          <button key={m} type="button" role="tab" id={`${id}-${m}-tab`} aria-selected={mode === m}
                  tabIndex={mode === m ? 0 : -1} onClick={() => setMode(m)}
                  className={`segment pressable ${mode === m ? 'segment-on' : ''}`}>
            {/* The tick, so the chosen one isn't told by its colour alone. */}
            <CheckIcon className="seg-check" />{label}
          </button>
        ))}
      </div>
      {/* Both stay mounted, so a half-built session survives a look at the other tab. */}
      <div className="mt-6" role="tabpanel" aria-labelledby={`${id}-pick-tab`} hidden={mode !== 'pick'}>{pick}</div>
      <div className="mt-6" role="tabpanel" aria-labelledby={`${id}-build-tab`} hidden={mode !== 'build'}>{build}</div>
    </>
  );
}
