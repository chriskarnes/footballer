import { KIND_LABELS, PHASES, sessionSeconds } from './speed';
import { isoDate, parseDate, position, weekPlan, type YearStart } from './speed-year';
import { splitSessionName } from './program-copy';
import { todayIn, type IcsEvent } from './ics';
import type { SessionRow } from './types';

/** What public.calendar_feed(token) returns. */
export type FeedData = {
  include_plan: boolean;
  include_speed: boolean;
  start_time: string | null;
  time_zone: string;
  speed_year: YearStart | null;
  plan_days: { weekday: number; slot: number; kind: string; session_id: string | null }[];
  completed: { source: string; source_ref: string | null; completed_at: string }[];
};

/** Two weeks back so recent ticks show, six ahead so the next month is planned. */
const PAST_DAYS = 14, FUTURE_DAYS = 42;

const addDays = (iso: string, n: number) => {
  const d = parseDate(iso); d.setDate(d.getDate() + n); return isoDate(d);
};

/**
 * The events for one player's feed: their active weekly plan and their speed
 * year, over a rolling window, each ticked if the session was finished on
 * that day.
 *
 * Every event's UID is its source, date and slot, never its content. That is
 * what makes the feed update in place: a calendar that sees the same UID with
 * a new title — a tick, a changed plan — replaces the event instead of adding
 * a second one.
 *
 * Dates are calendar dates in the player's zone, worked with as server-local
 * midnights; nothing here depends on the server's own zone.
 */
export function feedEvents(data: FeedData, sessions: SessionRow[], origin: string, now = new Date()): IcsEvent[] {
  const tz = validZone(data.time_zone) ? data.time_zone : 'UTC';
  const today = todayIn(tz, now);
  const from = addDays(today, -PAST_DAYS), to = addDays(today, FUTURE_DAYS);

  // "library:<id>" or "speed:<id>" → the local dates it was finished on.
  const done = new Map<string, Set<string>>();
  for (const w of data.completed) {
    if (!w.source_ref || !w.completed_at) continue;
    const key = `${w.source}:${w.source_ref}`;
    if (!done.has(key)) done.set(key, new Set());
    done.get(key)!.add(todayIn(tz, new Date(w.completed_at)));
  }
  const finished = (key: string, date: string) => !!done.get(key)?.has(date);

  const timed = (minutes: number, offset = 0) =>
    data.start_time ? { start: shift(data.start_time, offset), minutes, timeZone: tz } : undefined;
  const summary = (tick: boolean, title: string, minutes: number) =>
    `${tick ? '✓ ' : ''}${title} · ${minutes} min`;

  const events: IcsEvent[] = [];
  const byId = new Map(sessions.map((s) => [s.id, s]));

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = (parseDate(date).getDay() + 6) % 7;
    let offset = 0; // minutes already booked from the start time that day

    if (data.include_plan) {
      const slots = data.plan_days
        .filter((d) => d.weekday === weekday && d.kind !== 'rest' && d.session_id)
        .sort((a, b) => a.slot - b.slot);
      for (const d of slots) {
        const s = byId.get(d.session_id!);
        if (!s) continue;
        const minutes = Math.max(1, Math.round(s.total_minutes));
        const tick = finished(`library:${s.id}`, date);
        events.push({
          uid: `plan-${date}-${d.slot}@train.futbol`, date,
          summary: summary(tick, splitSessionName(s.name).title, minutes),
          description: `${tick ? 'Done. ' : ''}From your weekly plan.\n${origin}/session/${s.id}`,
          url: `${origin}/session/${s.id}`,
          timed: timed(minutes, offset),
        });
        offset += minutes;
      }
    }

    if (data.include_speed && isYearStart(data.speed_year)) {
      const pos = position(data.speed_year!, parseDate(date));
      if (pos.state === 'running') {
        const day = weekPlan(pos)[weekday];
        if (day.type === 'session') {
          const minutes = Math.round(sessionSeconds(day.session) / 60);
          const tick = finished(`speed:${day.session.id}`, date);
          const url = `${origin}/speed/session/${day.session.id}?from=speed`;
          events.push({
            uid: `speed-${date}@train.futbol`, date,
            summary: summary(tick, day.session.name, minutes),
            description: `${tick ? 'Done. ' : ''}Speed & Stamina · ${KIND_LABELS[day.session.kind]} · ${pos.phase.name}, week ${pos.weekOfYear + 1} of ${pos.totalWeeks}.\n${url}`,
            url, timed: timed(minutes, offset),
          });
        } else if (day.type === 'test') {
          events.push({
            uid: `speed-${date}@train.futbol`, date,
            summary: 'Speed test day',
            description: `Warm up, then the five tests. Height too.\n${origin}/speed/test`,
            url: `${origin}/speed/test`, timed: timed(45, offset),
          });
        }
      }
    }
  }
  return events;
}

function shift(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function validZone(tz: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

const isYearStart = (v: unknown): v is YearStart =>
  !!v && typeof (v as YearStart).monday === 'string' && PHASES.some((p) => p.id === (v as YearStart).phase);
