import 'server-only';
import type { Academy } from './branding-server';
import { progress, type Done, type PlanDay, type Progress } from './progress';

/** One player as academy_players() returns them. */
type Raw = {
  user_id: string; joined_at: string; email: string | null; display_name: string | null;
  positions: string[] | null; age_band: string | null; plan_name: string | null;
  plan_days: PlanDay[]; last_done: string | null; done: Done[];
};

export type Player = Raw & { name: string; first: string; progress: Progress };

/** The name a trainer knows them by: their own, or the front of their email. */
export function nameOf(r: { display_name: string | null; email: string | null }) {
  return r.display_name?.trim() || r.email?.split('@')[0] || 'Player';
}

/**
 * The academy's players with their progress worked out. Four weeks back is
 * all the dashboard draws; a single player's page asks for longer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPlayers(db: any, academy: Academy, opts: { player?: string; days?: number } = {}) {
  const since = new Date(Date.now() - (opts.days ?? 35) * 86400000).toISOString();
  const { data, error } = await db.rpc('academy_players', {
    p_academy: academy.id, p_since: since, p_player: opts.player ?? null,
  });
  if (error) return { players: [] as Player[], error: error.message as string };
  const players: Player[] = ((data ?? []) as Raw[]).map((r) => {
    const name = nameOf(r);
    return {
      ...r, name, first: name.split(/\s+/)[0],
      progress: progress({ planDays: r.plan_days ?? [], done: r.done ?? [], lastDone: r.last_done, tz: academy.timeZone }),
    };
  });
  return { players, error: null };
}
