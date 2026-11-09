import 'server-only';
import type { AddonRow, DrillRow, GroupRow, PlayerProgramRow, ProgramRow, SessionRow } from './academy-week';

export type AcademyContent = {
  programs: (ProgramRow & { description: string | null })[];
  sessions: SessionRow[];
  drills: DrillRow[];
  groups: GroupRow[];
  memberships: { group_id: string; user_id: string }[];
  playerPrograms: PlayerProgramRow[];
  addons: AddonRow[];
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
  const [programs, sessions, drills, groups, memberships, playerPrograms, addons] = await Promise.all([
    db.from('academy_programs').select('id, name, description, weeks').eq('academy_id', academyId).order('created_at'),
    db.from('academy_sessions').select('id, program_id, week, position, name, drill_ids').eq('academy_id', academyId),
    db.from('drills').select('id, name, amount, minutes, focus, video_url, how').eq('academy_id', academyId).order('name'),
    db.from('groups').select('id, name, meets_weekday, meets_time, program_id, starts_on, archived').eq('academy_id', academyId).order('name'),
    db.from('group_members').select('group_id, user_id').eq('academy_id', academyId),
    db.from('player_programs').select('user_id, program_id, starts_on').eq('academy_id', academyId),
    db.from('addons').select('id, user_id, drill_id, note, week_of').eq('academy_id', academyId).gte('week_of', since),
  ]);
  return {
    programs: programs.data ?? [], sessions: sessions.data ?? [], drills: drills.data ?? [],
    groups: groups.data ?? [], memberships: memberships.data ?? [],
    playerPrograms: playerPrograms.data ?? [], addons: addons.data ?? [],
    ready: !programs.error,
  };
}
