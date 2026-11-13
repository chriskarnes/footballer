'use client';
import { useEffect, useState } from 'react';
import { TESTS } from './speed';

/**
 * The athlete's card: every test day's numbers, kept in this browser.
 *
 * On-device rather than in Supabase for now because test day works signed
 * out, like Train — and a teenager's phone is the card. Moving it to a
 * `speed_tests` table later is a column per TESTS entry plus height and a
 * date, and this module is the only reader.
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

export function useSpeedCard() {
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { setEntries(read()); setReady(true); }, []);

  // One test day per date: recording the same day again replaces it, so the
  // date stays a key the table and Delete can rely on.
  const add = (e: TestEntry) => {
    const next = [...entries.filter((x) => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
    setEntries(next); write(next);
  };
  const remove = (date: string) => {
    const next = entries.filter((e) => e.date !== date);
    setEntries(next); write(next);
  };
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
