'use client';
import { useEffect, useState } from 'react';

const dayOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * The player's own "now": null until the page is in the browser (the
 * server's clock isn't theirs), and new again when the app comes back to
 * the front on a later day. An installed app left open overnight used to
 * show yesterday as today until something else reloaded it.
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      setNow((was) => (was && dayOf(was) === dayOf(new Date()) ? was : new Date()));
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, []);
  return now;
}
