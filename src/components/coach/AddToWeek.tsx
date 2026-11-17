'use client';
import { useState } from 'react';

/**
 * Two ways to put a session in a program week, one on screen at a time: tick
 * ones already made, or build a new one. They used to sit one above the
 * other, and the new session's drill list read as more sessions to pick.
 */
export function AddToWeek({ pick, build }: { pick: React.ReactNode; build: React.ReactNode }) {
  const [mode, setMode] = useState<'pick' | 'build'>('pick');
  return (
    <>
      <div className="segmented max-w-md" role="tablist" aria-label="How to add a session">
        {([['pick', 'From your sessions'], ['build', 'Build a new one']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
                  className={`segment pressable ${mode === id ? 'segment-on' : ''}`}>{label}</button>
        ))}
      </div>
      {/* Both stay mounted, so a half-built session survives a look at the other tab. */}
      <div className="mt-6" hidden={mode !== 'pick'}>{pick}</div>
      <div className="mt-6" hidden={mode !== 'build'}>{build}</div>
    </>
  );
}
