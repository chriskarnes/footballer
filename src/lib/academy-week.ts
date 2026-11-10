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
export type DrillRow = { id: string; name: string; amount: string | null; minutes: number; focus: string | null; focus_areas?: string[]; video_url: string | null; how: string | null };

/** Everything a drill works on: its tags, or its one focus from before tags. */
export const drillTags = (d: Pick<DrillRow, 'focus' | 'focus_areas'>): string[] =>
  d.focus_areas?.length ? d.focus_areas : d.focus ? [d.focus] : [];
export type GroupRow = { id: string; name: string; meets_weekday: number | null; meets_time: string | null; program_id: string | null; starts_on: string | null; archived?: boolean };
export type PlayerProgramRow = { user_id: string; program_id: string; starts_on: string };
export type AddonRow = { id: string; user_id: string; drill_id: string; note: string | null; week_of: string };
export type CompletionRow = { source: string; source_ref: string | null; completed_at: string | null };
/** The days a player already has soccer: club training, and a game. 0 = Monday. */
export type ScheduleRow = { user_id: string; club_days: number[]; game_day: number | null };
/** A session of a week built for one player (0010). Replaces their program that week. */
export type CustomRow = { id: string; user_id: string; week_of: string; position: number; name: string; drill_ids: string[]; weekday: number;
  made_by?: 'rules' | 'ai' | 'trainer'; note?: string | null };
/** One item moved to another day, for one week. */
export type MoveRow = { user_id: string; week_of: string; item_key: string; weekday: number };

export type WeekItem = {
  /** Stable within the week: what completion and keys use. */
  key: string;
  /** custom: a session from a week built for this player. */
  kind: 'session' | 'addon' | 'custom';
  /** academy_sessions.id, player_week_sessions.id or addons.id — the runner's source_ref. */
  ref: string;
  title: string;
  /** "U12 Tuesday · Week 3 of 8", or "Just for you". */
  from: string;
  /** Labels to show as the source: group names, or null for personal. */
  groups: string[];
  weekday: number;
  /** The player moved it here this week. */
  moved?: boolean;
  /** Where the app put it, before any move. */
  placed?: number;
  minutes: number;
  drills: number;
  note?: string | null;
  done: boolean;
  /** On a club or group training day: a second session that day. */
  practice?: boolean;
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

const WEEK = [0, 1, 2, 3, 4, 5, 6];

/**
 * Days to do `count` sessions on, around the soccer a player already has.
 *
 * Never on a game day. Not on club or group days while there are free days
 * enough; not the day after a game either, if that can be helped. Then
 * spread out across what's left, so two sessions aren't back to back when
 * they needn't be. With no soccer days known, it's just spread through the
 * week.
 */
export function placeDays(count: number, busy: { club?: number[]; game?: number | null; meets?: number[] } = {}): number[] {
  if (count <= 0) return [];
  const game = busy.game ?? null;
  const taken = new Set([...(busy.club ?? []), ...(busy.meets ?? []), ...(game === null ? [] : [game])]);
  const afterGame = game === null ? null : (game + 1) % 7;
  const tiers = [
    WEEK.filter((d) => !taken.has(d) && d !== afterGame),
    WEEK.filter((d) => !taken.has(d)),
    WEEK.filter((d) => d !== game),
    WEEK,
  ];
  // Fill from the best days down: every day of a tier before any of the next.
  const picked: number[] = [];
  for (const tier of tiers) {
    const open = tier.filter((d) => !picked.includes(d));
    const need = count - picked.length;
    picked.push(...(open.length <= need ? open : spread(open, need)));
    if (picked.length >= count) break;
  }
  // More sessions than days: doubles, from the start of the list.
  for (let i = 0; picked.length < count; i++) picked.push(picked[i]);
  return picked.sort((a, b) => a - b);
}

/** n of `days`, evenly through them and centred: 2 of 7 lands Tue and Fri, not Mon and Thu. */
function spread(days: number[], n: number) {
  return Array.from({ length: n }, (_, i) => days[Math.floor(((i + 0.5) * days.length) / n)]);
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
  schedules?: ScheduleRow[];
  moves?: MoveRow[];
  custom?: CustomRow[];
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

  // Each program's sessions, kept apart until every program is in, so the
  // days are chosen for the whole week at once rather than program by program.
  const runs: WeekItem[][] = [];
  const addProgram = (programId: string, startsOn: string, label: string | null) => {
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
    const made = list.map((s) => ({
      key: `s:${s.id}`, kind: 'session' as const, ref: s.id, title: s.name,
      from: `${p.name} · Week ${n} of ${p.weeks}`, groups: label ? [label] : [],
      weekday: 0, minutes: minutesOf(s.drill_ids), drills: s.drill_ids.length, done: false,
    }));
    seen.set(sig, made);
    runs.push(made);
  };

  const mine = input.schedules?.find((x) => x.user_id === userId);
  const meets = myGroups.map((g) => g.meets_weekday).filter((d): d is number => d !== null);

  // A week built for this player is their week: it replaces the programs.
  const built = (input.custom ?? []).filter((c) => c.user_id === userId && c.week_of === monday)
    .sort((a, b) => a.position - b.position);
  if (built.length) {
    for (const c of built) items.push({
      key: `c:${c.id}`, kind: 'custom', ref: c.id, title: c.name, from: 'Built for you', groups: [],
      weekday: c.weekday, minutes: minutesOf(c.drill_ids), drills: c.drill_ids.length, note: c.note ?? null, done: false,
    });
  } else {
    for (const g of myGroups) if (g.program_id && g.starts_on) addProgram(g.program_id, g.starts_on, g.name);
    for (const pp of input.playerPrograms.filter((x) => x.user_id === userId)) addProgram(pp.program_id, pp.starts_on, null);

    // Programs take turns, so two programs share the week instead of one
    // taking the early days; then the turns go on the days that fit.
    const order: WeekItem[] = [];
    for (let i = 0; runs.some((r) => i < r.length); i++) for (const r of runs) if (i < r.length) order.push(r[i]);
    const days = placeDays(order.length, { club: mine?.club_days ?? [], game: mine?.game_day ?? null, meets });
    order.forEach((it, i) => { it.weekday = days[i]; });
    items.push(...order);
  }

  for (const a of input.addons.filter((x) => x.user_id === userId && x.week_of === monday)) {
    const d = drills.get(a.drill_id);
    if (!d) continue;
    items.push({
      key: `a:${a.id}`, kind: 'addon', ref: a.id, title: d.name, from: 'Just for you', groups: [],
      weekday: weekdayOf(today), minutes: d.minutes, drills: 1, note: a.note, done: false,
    });
  }

  // The player's own moves for this week win.
  for (const m of input.moves ?? []) {
    if (m.user_id !== userId || m.week_of !== monday) continue;
    const it = items.find((x) => x.key === m.item_key);
    if (it && it.weekday !== m.weekday) { it.placed = it.weekday; it.weekday = m.weekday; it.moved = true; }
  }

  // Ticks: each finished run this week ticks one matching item.
  const finished = new Map<string, number>();
  for (const c of input.completions) {
    if (!c.source_ref || !c.completed_at) continue;
    if (c.source !== 'academy' && c.source !== 'addon') continue;
    const day = localDate(c.completed_at, input.tz ?? 'UTC');
    if (day < monday || day > addDays(monday, 6)) continue;
    // A built-week session runs as 'academy' too; its id says which it is.
    const keys = c.source === 'addon' ? [`a:${c.source_ref}`] : [`s:${c.source_ref}`, `c:${c.source_ref}`];
    for (const k of keys) finished.set(k, (finished.get(k) ?? 0) + 1);
  }
  for (const it of items) {
    const left = finished.get(it.key) ?? 0;
    if (left > 0) { it.done = true; finished.set(it.key, left - 1); }
  }

  // A session on a club or group day is a second one that day: say so.
  const practice = new Set([...(mine?.club_days ?? []), ...meets]);
  for (const it of items) if (practice.has(it.weekday)) it.practice = true;

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
