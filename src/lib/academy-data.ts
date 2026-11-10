import 'server-only';
import type { AddonRow, CustomRow, DrillRow, GroupRow, MoveRow, PlayerProgramRow, ProgramRow, ScheduleRow, SessionRow } from './academy-week';
import { DEFAULT_TARGET, type Target } from './week-builder';

/** A player's targets and focus, as the trainer set them (0010). */
export type PlanRow = { user_id: string; sessions: number | null; minutes: number | null; focus: string[]; autopilot: boolean };

export type AcademyContent = {
  programs: (ProgramRow & { description: string | null })[];
  sessions: SessionRow[];
  drills: DrillRow[];
  groups: GroupRow[];
  memberships: { group_id: string; user_id: string }[];
  playerPrograms: PlayerProgramRow[];
  addons: AddonRow[];
  /** Players' soccer days and this fortnight's moves; empty before 0008 runs. */
  schedules: ScheduleRow[];
  moves: MoveRow[];
  /** Weeks built for one player, targets and focus; empty before 0010 runs. */
  custom: CustomRow[];
  plans: PlanRow[];
  defaults: Target;
  /** False when the tables aren't there yet (migration 0007 not run). */
  ready: boolean;
};

/**
 * Everything an academy has built, as far as this viewer may see it: RLS
 * gives a trainer the lot, and a player only their own groups, programs and
 * add-ons (and the content, which every member reads).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadContent(db: any, academyId: string, opts: { addonsSince?: string } = {}): Promise<AcademyContent> {
  const since = opts.addonsSince ?? new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const [programs, sessions, drills, groups, memberships, playerPrograms, addons, schedules, moves, custom, plans, defaults] = await Promise.all([
    db.from('academy_programs').select('id, name, description, weeks').eq('academy_id', academyId).order('created_at'),
    db.from('academy_sessions').select('id, program_id, week, position, name, drill_ids').eq('academy_id', academyId),
    drillsQuery(db, academyId),
    db.from('groups').select('id, name, meets_weekday, meets_time, program_id, starts_on, archived').eq('academy_id', academyId).order('name'),
    db.from('group_members').select('group_id, user_id').eq('academy_id', academyId),
    db.from('player_programs').select('user_id, program_id, starts_on').eq('academy_id', academyId),
    db.from('addons').select('id, user_id, drill_id, note, week_of').eq('academy_id', academyId).gte('week_of', since),
    // RLS: a player gets their own row; a trainer gets their players'.
    db.from('player_schedules').select('user_id, club_days, game_day'),
    db.from('session_moves').select('user_id, week_of, item_key, weekday').eq('academy_id', academyId).gte('week_of', since),
    customQuery(db, academyId, since),
    db.from('player_plans').select('user_id, sessions, minutes, focus, autopilot').eq('academy_id', academyId),
    db.from('academy_plan_defaults').select('sessions, minutes').eq('academy_id', academyId).maybeSingle(),
  ]);
  return {
    programs: programs.data ?? [], sessions: sessions.data ?? [], drills: drills.data ?? [],
    groups: groups.data ?? [], memberships: memberships.data ?? [],
    playerPrograms: playerPrograms.data ?? [], addons: addons.data ?? [],
    schedules: schedules.data ?? [], moves: moves.data ?? [],
    custom: custom.data ?? [], plans: plans.data ?? [],
    defaults: defaults.data ? { sessions: defaults.data.sessions, minutes: defaults.data.minutes } : DEFAULT_TARGET,
    ready: !programs.error,
  };
}

/** Built-week sessions with their notes; without them before migration 0011 adds the column. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function customQuery(db: any, academyId: string, since: string) {
  const cols = 'id, user_id, week_of, position, name, drill_ids, weekday, made_by';
  const q = (c: string) => db.from('player_week_sessions').select(c).eq('academy_id', academyId).gte('week_of', since);
  for (const extra of [', note, steps, light, changes', ', note']) {
    const r = await q(cols + extra);
    if (!r.error) return r;
  }
  return q(cols);
}

/** Drills with their tags; without them before migration 0008 adds the column. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function drillsQuery(db: any, academyId: string) {
  const cols = 'id, name, amount, minutes, focus, video_url, how';
  // Newest columns first: harder versions (0012), tags (0008).
  for (const extra of [', focus_areas, harder_id', ', focus_areas']) {
    const r = await db.from('drills').select(cols + extra).eq('academy_id', academyId).order('name');
    if (!r.error) return r;
  }
  return db.from('drills').select(cols).eq('academy_id', academyId).order('name');
}
/** A player's target: their own numbers where set, the academy's where not. */
export function targetFor(c: Pick<AcademyContent, 'plans' | 'defaults'>, userId: string): Target & { focus: string[]; autopilot: boolean; own: boolean } {
  const p = c.plans.find((x) => x.user_id === userId);
  return {
    sessions: p?.sessions ?? c.defaults.sessions, minutes: p?.minutes ?? c.defaults.minutes,
    focus: p?.focus ?? [], autopilot: p?.autopilot ?? false, own: !!(p && (p.sessions || p.minutes)),
  };
}
