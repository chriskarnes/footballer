import 'server-only';
import type { AddonRow, DrillRow, GroupRow, MoveRow, PlayerProgramRow, ProgramRow, ScheduleRow, SessionRow } from './academy-week';

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
  const [programs, sessions, drills, groups, memberships, playerPrograms, addons, schedules, moves] = await Promise.all([
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
  ]);
  return {
    programs: programs.data ?? [], sessions: sessions.data ?? [], drills: drills.data ?? [],
    groups: groups.data ?? [], memberships: memberships.data ?? [],
    playerPrograms: playerPrograms.data ?? [], addons: addons.data ?? [],
    schedules: schedules.data ?? [], moves: moves.data ?? [],
    ready: !programs.error,
  };
}

/** Drills with their tags; without them before migration 0008 adds the column. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function drillsQuery(db: any, academyId: string) {
  const cols = 'id, name, amount, minutes, focus, video_url, how';
  const tagged = await db.from('drills').select(`${cols}, focus_areas`).eq('academy_id', academyId).order('name');
  return tagged.error ? db.from('drills').select(cols).eq('academy_id', academyId).order('name') : tagged;
}
