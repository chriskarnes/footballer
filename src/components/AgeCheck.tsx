'use client';
import { useEffect, useState } from 'react';
import { Chip } from './Chip';
import { AGE_BANDS, isUnder13 } from '@/lib/child';

/**
 * The age question, asked of a player before they give an email (COPPA). It
 * offers every range, says nothing about 13, and once an under-13 range is
 * picked this phone remembers it for a day, so going back and picking
 * another doesn't get round it. The range picked isn't kept: profile setup
 * asks again, for the trainer.
 */
const KEY = 'tf-under13';
const DAY = 86_400_000;

/** Whether this phone said "under 13" in the last day, and a way to say it. */
export function useUnder13(): [boolean, () => void] {
  const [young, setYoung] = useState(false);
  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(KEY));
      if (at && Date.now() - at < DAY) setYoung(true);
    } catch { /* private mode: asked each time */ }
  }, []);
  const mark = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* still shown */ }
    setYoung(true);
  };
  return [young, mark];
}

export function AgeQuestion({ onOlder, onYounger }: { onOlder: (band: string) => void; onYounger: () => void }) {
  return (
    <fieldset className="card p-5">
      <legend className="sr-only">How old are you?</legend>
      <div className="h-card" aria-hidden>How old are you?</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {AGE_BANDS.map(([v, l]) => (
          <Chip key={v} on={false} onClick={() => (isUnder13(v) ? onYounger() : onOlder(v))}>{l}</Chip>
        ))}
      </div>
    </fieldset>
  );
}

/** For a player under 13: a parent or guardian signs up instead, with their own email. */
export function GrownUpSignsUp({ children }: { children?: React.ReactNode }) {
  return (
    <div className="card p-5" role="status">
      <div className="h-card">A parent or guardian signs up for you</div>
      <p className="mt-1.5 text-body leading-relaxed text-on-surface-variant">
        For players under 13, a parent or guardian makes the account with their own email, and says it&rsquo;s OK for you to train. Hand them the phone, or send them this page.
      </p>
      {children}
    </div>
  );
}
