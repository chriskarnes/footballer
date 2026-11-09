/**
 * A player's week from their trainer: the groups they're in, any program set
 * for them alone, and the drills added "just for you" — merged into one list,
 * each item saying where it came from.
 *
 * Pure, so the trainer's dashboard and the player's own screen work it out
 * the same way. Weeks are Monday to Sunday in the academy's zone; week 1 of a
 * program is the week its start date falls in. A program week with no
 * sessions repeats the last week before it that has some.
 */
import { addDays, localDate, mondayOf, weekdayOf } from './progress';

export type ProgramRow = { id: string; name: string; weeks: number };
export type SessionRow = { id: string; program_id: string; week: number; position: number; name: string; drill_ids: string[] };
export type DrillRow = { id: string; name: string; amount: string | null; minutes: number; focus: string | null; video_url: string | null; how: string | null };
export type GroupRow = { id: string; name: string; meets_weekday: number | null; meets_time: string | null; program_id: string | null; starts_on: string | null; archived?: boolean };
export type PlayerProgramRow = { user_id: string; program_id: string; starts_on: string };
export type AddonRow = { id: string; user_id: string; drill_id: string; note: string | null; week_of: string };
export type CompletionRow = { source: string; source_ref: string | null; completed_at: string | null };

export type WeekItem = {
  /** Stable within the week: what completion and keys use. */
  key: string;
  kind: 'session' | 'addon';
  /** academy_sessions.id or addons.id — the runner's source_ref. */
  ref: string;
  title: string;
  /** "U12 Tuesday · Week 3 of 8", or "Just for you". */
  from: string;
  /** Labels to show as the source: group names, or null for personal. */
  groups: string[];
  weekday: number;
  minutes: number;
  drills: number;
  note?: string | null;
  done: boolean;
};

/** Which week of a program a date is in, 1-based; null before it starts or after it ends. */
export function programWeek(startsOn: string, weeks: number, today: string): number | null {
  const n = Math.floor((Date.parse(mondayOf(today)) - Date.parse(mondayOf(startsOn))) / (7 * 86400000)) + 1;
  return n >= 1 && n <= weeks ? n : null;
}

/** The sessions for week n, or the last earlier week that has any. */
export function sessionsForWeek(all: SessionRow[], programId: string, n: number): SessionRow[] {
  const mine = all.filter((s) => s.program_id === programId && s.week <= n);
  if (!mine.length) return [];
  const week = Math.max(...mine.map((s) => s.week));
  return mine.filter((s) => s.week === week).sort((a, b) => a.position - b.position);
}

/**
 * Days to do `count` sessions on: spread through the week, away from the day
 * the group meets (that's training already). Without a meeting day, spread
 * from Monday.
 */
export function spreadDays(count: number, meets: number | null): number[] {
  const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== meets);
  // Start the day after the meeting, so homework follows the session.
  const start = meets === null ? 0 : Math.max(0, free.findIndex((d) => d > meets));
  const order = [...free.slice(start), ...free.slice(0, start)];
  return Array.from({ length: count }, (_, i) => order[Math.floor((i * order.length) / count)] ?? order[0]).sort((a, b) => a - b);
}

export function buildWeek(input: {
  userId: string;
  today: string;
  groups: GroupRow[];
  memberships: { group_id: string; user_id: string }[];
  playerPrograms: PlayerProgramRow[];
  programs: ProgramRow[];
  sessions: SessionRow[];
  drills: DrillRow[];
  addons: AddonRow[];
  completions: CompletionRow[];
  tz?: string;
}): WeekItem[] {
  const { userId, today } = input;
  const monday = mondayOf(today);
  const programs = new Map(input.programs.map((p) => [p.id, p]));
  const drills = new Map(input.drills.map((d) => [d.id, d]));
  const minutesOf = (ids: string[]) => ids.reduce((a, id) => a + (drills.get(id)?.minutes ?? 0), 0);
  const items: WeekItem[] = [];
  // The same sessions reached two ways (two groups, or a group and on their
  // own) appear once, under every group that set them.
  const seen = new Map<string, WeekItem[]>();

  const myGroups = input.groups.filter((g) => !g.archived
    && input.memberships.some((m) => m.group_id === g.id && m.user_id === userId));

  const addProgram = (programId: string, startsOn: string, label: string | null, meets: number | null) => {
    const p = programs.get(programId);
    if (!p) return;
    const n = programWeek(startsOn, p.weeks, today);
    if (n === null) return;
    // Two groups on one program can be at different weeks: merge only when
    // they land on the same sessions.
    const list = sessionsForWeek(input.sessions, programId, n);
    const sig = list.map((s) => s.id).join(',');
    if (!sig) return;
    if (seen.has(sig)) {
      if (label) for (const it of seen.get(sig)!) if (!it.groups.includes(label)) it.groups.push(label);
      return;
    }
    const days = spreadDays(list.length, meets);
    const made = list.map((s, i) => ({
      key: `s:${s.id}`, kind: 'session' as const, ref: s.id, title: s.name,
      from: `${p.name} · Week ${n} of ${p.weeks}`, groups: label ? [label] : [],
      weekday: days[i], minutes: minutesOf(s.drill_ids), drills: s.drill_ids.length, done: false,
    }));
    seen.set(sig, made);
    items.push(...made);
  };

  for (const g of myGroups) if (g.program_id && g.starts_on) addProgram(g.program_id, g.starts_on, g.name, g.meets_weekday);
  for (const pp of input.playerPrograms.filter((x) => x.user_id === userId)) addProgram(pp.program_id, pp.starts_on, null, null);

  for (const a of input.addons.filter((x) => x.user_id === userId && x.week_of === monday)) {
    const d = drills.get(a.drill_id);
    if (!d) continue;
    items.push({
      key: `a:${a.id}`, kind: 'addon', ref: a.id, title: d.name, from: 'Just for you', groups: [],
      weekday: weekdayOf(today), minutes: d.minutes, drills: 1, note: a.note, done: false,
    });
  }

  // Ticks: each finished run this week ticks one matching item.
  const finished = new Map<string, number>();
  for (const c of input.completions) {
    if (!c.source_ref || !c.completed_at) continue;
    if (c.source !== 'academy' && c.source !== 'addon') continue;
    const day = localDate(c.completed_at, input.tz ?? 'UTC');
    if (day < monday || day > addDays(monday, 6)) continue;
    const k = `${c.source === 'addon' ? 'a' : 's'}:${c.source_ref}`;
    finished.set(k, (finished.get(k) ?? 0) + 1);
  }
  for (const it of items) {
    const left = finished.get(it.key) ?? 0;
    if (left > 0) { it.done = true; finished.set(it.key, left - 1); }
  }

  return items.sort((a, b) => a.weekday - b.weekday || (a.kind === 'addon' ? 1 : 0) - (b.kind === 'addon' ? 1 : 0));
}

/** The week as progress() wants it: one planned slot per item, on its day. */
export const asPlanDays = (items: WeekItem[]) =>
  items.map((it, i) => ({ weekday: it.weekday, slot: 10 + i, kind: 'technical' }));

/** "Tue 5:00 pm" */
export function meetingLabel(g: Pick<GroupRow, 'meets_weekday' | 'meets_time'>): string | null {
  if (g.meets_weekday === null) return null;
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][g.meets_weekday];
  if (!g.meets_time) return day;
  const [h, m] = g.meets_time.split(':').map(Number);
  return `${day} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
