import 'server-only';
import { cache } from 'react';
import { getViewer } from './viewer';
import { loadContent } from './academy-data';
import { buildWeek, meetingLabel, type WeekItem } from './academy-week';
import { localDate } from './progress';

export type MyWeek = {
  items: WeekItem[];
  /** The groups they're in, with when they meet: "U12 Tuesday · Tue 5:00 pm". */
  groups: { name: string; when: string | null }[];
  today: number;
  /** A program description, when one program is the week. */
  about: string | null;
  /** Their soccer days, or null if they haven't said. */
  schedule: { club: number[]; game: number | null } | null;
};

/**
 * The signed-in player's week from their trainer, or null when there's no
 * academy, no account, or nothing set. Once per render.
 */
export const getMyWeek = cache(async (): Promise<MyWeek | null> => {
  const v = await getViewer();
  if (!v.academy || !v.user || !v.role) return null;
  const c = await loadContent(v.db, v.academy.id);
  if (!c.ready) return null;
  const tz = v.academy.timeZone;
  const today = localDate(new Date(), tz);
  const { data: done } = await v.db.from('workouts').select('source, source_ref, completed_at')
    .eq('user_id', v.user.id).eq('status', 'completed').in('source', ['academy', 'addon'])
    .gte('completed_at', new Date(Date.now() - 8 * 86400000).toISOString());
  const items = buildWeek({ userId: v.user.id, today, tz, ...c, completions: done ?? [] });
  const mine = c.groups.filter((g) => !g.archived && c.memberships.some((m) => m.group_id === g.id && m.user_id === v.user!.id));
  if (!items.length && !mine.length) return null;
  const programIds = new Set([...mine.map((g) => g.program_id), ...c.playerPrograms.filter((p) => p.user_id === v.user!.id).map((p) => p.program_id)].filter(Boolean));
  const about = programIds.size === 1 ? c.programs.find((p) => programIds.has(p.id))?.description ?? null : null;
  return {
    items,
    groups: mine.map((g) => ({ name: g.name, when: meetingLabel(g) })),
    today: (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7,
    about,
    schedule: (() => {
      const s = c.schedules.find((x) => x.user_id === v.user!.id);
      return s ? { club: s.club_days, game: s.game_day } : null;
    })(),
  };
});
