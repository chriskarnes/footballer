'use client';
import { useEffect, useState } from 'react';
import { PHASES, sessionsFor, WEEK_TEMPLATE, BLOCK_WEEKS, type PhaseId, type SpeedSession } from './speed';

/**
 * Where an athlete is in the speed year.
 *
 * The program is 48 weeks — four phases of three 4-week blocks — and the
 * module used to be a catalogue of it: the athlete had to work out which
 * phase, block and week they were in, and which of the 60 sessions that
 * made today. Now they start the year once and the module counts weeks.
 *
 * All that's stored is the Monday the year started on and the phase it
 * started at, in this browser — like the test-day card, because the module
 * works signed out. Position is arithmetic on today's date, in local time
 * (the athlete's Monday, not the server's).
 */

export interface YearStart {
  /** Local date of the Monday week 1 began, YYYY-MM-DD. */
  monday: string;
  /** The phase week 1 belongs to. Starting mid-year is normal — the phases
   *  follow the football calendar, so a player starting in May starts in Power. */
  phase: PhaseId;
}

const KEY = 'forge.speed.year.v1';
const DAY_MS = 86400000;

/** Midnight of the local Monday on or before `d`. */
export function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A local date from YYYY-MM-DD — not `new Date(iso)`, which reads it as UTC. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The phase the calendar says it is: Nov–Jan Foundation, Feb–Apr Build,
 *  May–Jul Power, Aug–Oct In-season. The default when starting. */
export function phaseForMonth(d: Date): PhaseId {
  const m = d.getMonth(); // 0 = Jan
  if (m === 10 || m === 11 || m === 0) return 'foundation';
  if (m <= 3) return 'build';
  if (m <= 6) return 'power';
  return 'inseason';
}

export type Position =
  | { state: 'upcoming'; startsOn: Date }
  | { state: 'finished' }
  | {
      state: 'running';
      phase: (typeof PHASES)[number];
      block: 1 | 2 | 3;
      /** 1–4 within the block. Week 4 is test week. */
      week: 1 | 2 | 3 | 4;
      weekName: string;
      /** 0 = Monday. */
      today: number;
      /** Weeks since the start, 0-based — for "week 7 of 48". */
      weekOfYear: number;
      totalWeeks: number;
    };

export function position(start: YearStart, now = new Date()): Position {
  const first = parseDate(start.monday);
  const weeks = Math.floor((mondayOf(now).getTime() - first.getTime()) / (7 * DAY_MS));
  if (weeks < 0) return { state: 'upcoming', startsOn: first };

  // A year is all four phases, wherever it starts: begin in May at Power and
  // it runs Power, In-season, then round to Foundation and Build — the
  // program's own rule is that In-season ends by restarting at Phase 1.
  const startIdx = PHASES.findIndex((p) => p.id === start.phase);
  const phasesDone = Math.floor(weeks / 12);
  if (phasesDone >= PHASES.length) return { state: 'finished' };
  const phaseIdx = (startIdx + phasesDone) % PHASES.length;

  const inPhase = weeks % 12;
  const week = ((inPhase % 4) + 1) as 1 | 2 | 3 | 4;
  return {
    state: 'running',
    phase: PHASES[phaseIdx],
    block: (Math.floor(inPhase / 4) + 1) as 1 | 2 | 3,
    week,
    weekName: BLOCK_WEEKS[week - 1].name,
    today: (now.getDay() + 6) % 7,
    weekOfYear: weeks,
    totalWeeks: PHASES.length * 12,
  };
}

export type DayPlan =
  | { day: string; weekday: number; type: 'session'; session: SpeedSession }
  | { day: string; weekday: number; type: 'test' }
  | { day: string; weekday: number; type: 'off'; label: string };

/** The seven days of the current week. In test week, Thursday's Speed B is
 *  the test day — the block's own rule, from BLOCK_WEEKS. */
export function weekPlan(pos: Extract<Position, { state: 'running' }>): DayPlan[] {
  const sessions = sessionsFor(pos.phase.id, pos.block);
  return WEEK_TEMPLATE.map((t, weekday) => {
    if (!t.kind) return { day: t.day, weekday, type: 'off', label: t.label };
    if (pos.week === 4 && t.kind === 'speedB') return { day: t.day, weekday, type: 'test' };
    const session = sessions.find((s) => s.kind === t.kind)!;
    return { day: t.day, weekday, type: 'session', session };
  });
}

/** Reading and writing the start, after mount — localStorage doesn't exist on
 *  the server, and a missing or blocked store just means "not started". */
export function useYearStart() {
  const [start, setStart] = useState<YearStart | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const v = raw ? JSON.parse(raw) : null;
      if (v && typeof v.monday === 'string' && PHASES.some((p) => p.id === v.phase)) setStart(v);
    } catch { /* not started */ }
    setReady(true);
  }, []);

  const save = (next: YearStart | null) => {
    setStart(next);
    try {
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch { /* private mode: it lasts this visit */ }
  };
  return { start, ready, save };
}
