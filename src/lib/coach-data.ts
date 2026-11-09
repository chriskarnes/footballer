import 'server-only';
import type { Academy } from './branding-server';
import { localDate, progress, type Done, type PlanDay, type Progress } from './progress';
import { loadContent, type AcademyContent } from './academy-data';
import { asPlanDays, buildWeek, type WeekItem } from './academy-week';

/** One player as academy_players() returns them. */
type Raw = {
  user_id: string; joined_at: string; email: string | null; display_name: string | null;
  positions: string[] | null; age_band: string | null; plan_name: string | null;
  plan_days: PlanDay[]; last_done: string | null; done: Done[];
};

export type Player = Raw & { name: string; first: string; progress: Progress; week: WeekItem[]; groups: string[] };

/** The name a trainer knows them by: their own, or the front of their email. */
export function nameOf(r: { display_name: string | null; email: string | null }) {
  return r.display_name?.trim() || r.email?.split('@')[0] || 'Player';
}

/**
 * The academy's players with their progress worked out. Four weeks back is
 * all the dashboard draws; a single player's page asks for longer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPlayers(db: any, academy: Academy, opts: { player?: string; days?: number; content?: AcademyContent } = {}) {
  const since = new Date(Date.now() - (opts.days ?? 35) * 86400000).toISOString();
  const [{ data, error }, content] = await Promise.all([
    db.rpc('academy_players', { p_academy: academy.id, p_since: since, p_player: opts.player ?? null }),
    opts.content ? Promise.resolve(opts.content) : loadContent(db, academy.id),
  ]);
  if (error) return { players: [] as Player[], error: error.message as string };
  const today = localDate(new Date(), academy.timeZone);
  const ids = ((data ?? []) as Raw[]).map((r) => r.user_id);
  // What each player finished from their trainer's week, to tick its items.
  const { data: ticks } = ids.length && content.ready
    ? await db.rpc('academy_completions', { p_academy: academy.id, p_since: new Date(Date.now() - 8 * 86400000).toISOString() })
    : { data: [] };
  const players: Player[] = ((data ?? []) as Raw[]).map((r) => {
    const name = nameOf(r);
    // The trainer's week (groups, own programs, add-ons) on top of any week
    // the player built themselves: both are what they're meant to do.
    const week = buildWeek({
      userId: r.user_id, today, tz: academy.timeZone, ...content,
      completions: ((ticks ?? []) as { user_id: string; source: string; source_ref: string | null; completed_at: string | null }[])
        .filter((t) => t.user_id === r.user_id),
    });
    const groups = content.groups.filter((g) => !g.archived
      && content.memberships.some((m) => m.group_id === g.id && m.user_id === r.user_id)).map((g) => g.name);
    return {
      ...r, name, first: name.split(/\s+/)[0], week, groups,
      progress: progress({ planDays: [...(r.plan_days ?? []), ...asPlanDays(week)], done: r.done ?? [], lastDone: r.last_done, tz: academy.timeZone }),
    };
  });
  return { players, error: null };
}
