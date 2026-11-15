'use client';
import { lastUser } from './phone-session';
import { useEffect, useState } from 'react';
import { browserClient } from './supabase/client';
import { PHASES } from './speed';
import { YEAR_KEY, type YearStart } from './speed-year';

const valid = (v: any): v is YearStart =>
  !!v && typeof v.monday === 'string' && PHASES.some((p) => p.id === v.phase);

/**
 * Reading and writing the start, after mount — localStorage doesn't exist on
 * the server, and a missing or blocked store just means "not started".
 *
 * Signed in, the profile holds it too (profiles.speed_year), because the
 * calendar feed is read by a calendar server that has no browser. The profile
 * wins when both have one: it is what every device and the feed agree on, and
 * every save here writes it. A signed-out start is pushed up the first time
 * the player is seen signed in. Any failure — signed out, migration not run —
 * leaves the browser copy working exactly as before.
 */
export function useYearStart() {
  const [start, setStart] = useState<YearStart | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let local: YearStart | null = null;
    try {
      const raw = localStorage.getItem(YEAR_KEY);
      const v = raw ? JSON.parse(raw) : null;
      if (valid(v)) local = v;
    } catch { /* not started */ }
    setStart(local);
    setReady(true);

    (async () => {
      try {
        const db = browserClient();
        const { data: { user } } = await db.auth.getUser();
        if (!user) return;
        const { data, error } = await db.from('profiles').select('speed_year').eq('id', user.id).maybeSingle();
        if (error) return;
        if (unsent()) {
          // Changed on this phone and not sent yet (no signal then): the
          // phone's is the newer one. Send it; don't put the old one back.
          const { error: e } = await db.from('profiles').update({ speed_year: local }).eq('id', user.id);
          if (!e) mark(false);
        } else if (valid(data?.speed_year)) {
          setStart(data.speed_year);
          try { localStorage.setItem(YEAR_KEY, JSON.stringify(data.speed_year)); } catch { /* fine */ }
        } else if (local) {
          await db.from('profiles').update({ speed_year: local }).eq('id', user.id);
        }
      } catch { /* not configured */ }
    })();
  }, []);

  const save = (next: YearStart | null) => {
    setStart(next);
    try {
      if (next) localStorage.setItem(YEAR_KEY, JSON.stringify(next));
      else localStorage.removeItem(YEAR_KEY);
    } catch { /* private mode: it lasts this visit */ }
    // Marked until the account has it: a change made with no signal used to
    // be undone on the next visit, when the account's older one came back.
    // (Only with an account on this phone: a year set signed out is the
    // first-meeting case, where the account's own start wins.)
    if (lastUser()) mark(true);
    (async () => {
      try {
        const db = browserClient();
        const { data: { user } } = await db.auth.getUser();
        if (!user) return;
        const { error } = await db.from('profiles').update({ speed_year: next }).eq('id', user.id);
        if (!error) mark(false);
      } catch { /* signed out, no signal or not configured: it stays marked */ }
    })();
  };
  return { start, ready, save };
}

/** Set while this phone has a year start the account hasn't got yet. Cleared
 *  with the rest of a player's things when the account here changes (page-cache.ts). */
const UNSENT = `${YEAR_KEY}.unsent`;
const mark = (on: boolean) => { try { if (on) localStorage.setItem(UNSENT, '1'); else localStorage.removeItem(UNSENT); } catch { /* fine */ } };
const unsent = () => { try { return localStorage.getItem(UNSENT) === '1'; } catch { return false; } };
