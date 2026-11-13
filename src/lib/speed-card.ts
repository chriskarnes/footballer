'use client';
import { useEffect, useState } from 'react';
import { TESTS } from './speed';
import { browserClient } from './supabase/client';

/**
 * The athlete's card: every test day's numbers.
 *
 * Kept on the phone, so test day works signed out and offline, and on the
 * account too (profiles.speed_tests, 0024) once signed in, so the card
 * follows them to another phone, survives a cleared browser, is the same in
 * Safari and the installed app, and their trainer can see it.
 *
 * Sync: the first time a phone meets the account, the two are merged (a day
 * on either is kept). After that the account is the truth, so a day deleted
 * on one phone doesn't come back from another.
 */

export interface TestEntry {
  /** ISO date of the test day. */
  date: string;
  /** Which block it closed — e.g. "Foundation · block 2". */
  label: string;
  /** TESTS id → value. Missing when a test was skipped. */
  values: Record<string, number>;
  height?: number;
  note?: string;
}

const KEY = 'forge.speed.card.v1';
/** Set once this phone's card has been merged into the account's. */
const SYNCED = 'forge.speed.card.synced';

/** A date as the player's own calendar day, YYYY-MM-DD. Not toISOString(),
 *  which is UTC: in the evening in the Americas that's already tomorrow. */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function read(): TestEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function write(entries: TestEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* private mode, full, etc. */ }
}

const byDate = (a: TestEntry, b: TestEntry) => a.date.localeCompare(b.date);
const valid = (v: unknown): v is TestEntry[] =>
  Array.isArray(v) && v.every((e) => e && typeof e.date === 'string' && typeof e.values === 'object');

/** The signed-in player, or null: signed out, or Supabase not configured. */
async function account() {
  try {
    const db = browserClient();
    const { data: { session } } = await db.auth.getSession();
    return session ? { db, id: session.user.id } : null;
  } catch { return null; }
}

/** Saves the card to the account. Quietly: the phone's copy is already kept. */
async function upload(entries: TestEntry[]) {
  const me = await account();
  if (!me) return;
  try { await me.db.from('profiles').update({ speed_tests: entries }).eq('id', me.id); } catch { /* next time */ }
}

export function useSpeedCard() {
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const local = read();
    setEntries(local); setReady(true);
    let live = true;
    (async () => {
      const me = await account();
      if (!me) return;
      const { data, error } = await me.db.from('profiles').select('speed_tests').eq('id', me.id).maybeSingle();
      if (error || !live) return;          // column not there yet (0024), or offline
      const remote = valid(data?.speed_tests) ? data.speed_tests : [];
      let merged = remote;
      // Merged once per phone. A phone that already synced with another
      // account (a sibling on the family phone) takes this account's card
      // as it is, rather than merging someone else's days into it.
      let was: string | null = null;
      try { was = localStorage.getItem(SYNCED); } catch { /* fine */ }
      if (was && was !== me.id) {
        try { localStorage.setItem(SYNCED, me.id); } catch { /* fine */ }
      } else if (!was) {
        // First meeting: keep every day from both; the account's wins a clash.
        const days = new Map(local.map((e) => [e.date, e]));
        for (const e of remote) days.set(e.date, e);
        merged = [...days.values()].sort(byDate);
        if (merged.length !== remote.length) await upload(merged);
        try { localStorage.setItem(SYNCED, me.id); } catch { /* fine */ }
      }
      if (!live) return;
      setEntries(merged); write(merged);
    })();
    return () => { live = false; };
  }, []);

  const save = (next: TestEntry[]) => { setEntries(next); write(next); upload(next); };
  // One test day per date: recording the same day again replaces it, so the
  // date stays a key the table and Delete can rely on.
  const add = (e: TestEntry) => save([...entries.filter((x) => x.date !== e.date), e].sort(byDate));
  const remove = (date: string) => save(entries.filter((e) => e.date !== date));
  return { entries, ready, add, remove };
}

/** Personal best per test, honouring the direction of each one. */
export function bests(entries: TestEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of TESTS) {
    const vals = entries.map((e) => e.values[t.id]).filter((v): v is number => typeof v === 'number');
    if (!vals.length) continue;
    out[t.id] = t.lowerIsBetter ? Math.min(...vals) : Math.max(...vals);
  }
  return out;
}

/** Height gained since the previous test day, for the growth-spurt rule. */
export function heightGain(entries: TestEntry[]): number | null {
  const withH = entries.filter((e) => typeof e.height === 'number');
  if (withH.length < 2) return null;
  const a = withH[withH.length - 2].height!, b = withH[withH.length - 1].height!;
  return Math.round((b - a) * 10) / 10;
}
