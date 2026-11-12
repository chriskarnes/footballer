import 'server-only';
import { cache } from 'react';
import { getViewer } from './viewer';
import { loadContent } from './academy-data';
import { buildWeek, meetingLabel, type WeekItem } from './academy-week';
import { localDate } from './progress';

export type MyWeek = {
  items: WeekItem[];
  /** The groups they're in, with when they meet: "U12 Tuesday · Tue 5:00 pm". */
  groups: { name: string; when: string | null; day: number | null }[];
  today: number;
  /** A program description, when one program is the week. */
  about: string | null;
  /** Their soccer days, or null if they haven't said. */
  schedule: { club: number[]; game: number | null } | null;
  /**
   * Adding a session of their own (0015): how many are left this week, or
   * why not now. Null when their trainer hasn't allowed it.
   */
  more: { left: number; why: string | null } | null;
};

/**
 * The signed-in player's week from their trainer, or null when there's no
 * academy, no account, or nothing set. Once per render.
 */
export const getMyWeek = cache(async (): Promise<MyWeek | null> => {
  const week = await readMyWeek();
  return week && (week.items.length || week.groups.length) ? week : null;
});

/**
 * The same week, kept even when it's empty: a member with nothing set still
 * has soccer days and may still be allowed extras. Null only when there's no
 * academy, no account, or the tables aren't there yet.
 */
export const readMyWeek = cache(async (): Promise<MyWeek | null> => {
  const v = await getViewer();
  if (!v.academy || !v.user || !v.role) return null;
  const c = await loadContent(v.db, v.academy.id);
  if (!c.ready) return null;
  const tz = v.academy.timeZone;
  const today = localDate(new Date(), tz);
  const { data: done } = await v.db.from('workouts').select('source, source_ref, completed_at')
    .eq('user_id', v.user.id).eq('status', 'completed').in('source', ['academy', 'addon'])
    .gte('completed_at', new Date(Date.now() - 8 * 86400000).toISOString())
    // Oldest first: a session done twice keeps the tick from the first time.
    .order('completed_at');
  const items = buildWeek({ userId: v.user.id, today, tz, ...c, completions: done ?? [] });
  const mine = c.groups.filter((g) => !g.archived && c.memberships.some((m) => m.group_id === g.id && m.user_id === v.user!.id));
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const sched = c.schedules.find((x) => x.user_id === v.user!.id);
  const allowed = c.defaults.playerExtras;
  const left = Math.max(0, allowed - items.filter((i) => i.extra).length);
  // The rules: today's set session first, rest on a game day, within the trainer's number.
  const why = !c.drills.length ? 'Your trainer hasn’t added drills yet.'
    : sched?.game_day === weekday ? 'Game day. Rest up.'
    : items.some((i) => !i.extra && !i.done && i.weekday <= weekday) ? 'Finish today’s session first.'
    : !left ? `That’s ${allowed === 1 ? 'your extra' : `all ${allowed} extras`} this week.`
    : null;
  const programIds = new Set([...mine.map((g) => g.program_id), ...c.playerPrograms.filter((p) => p.user_id === v.user!.id).map((p) => p.program_id)].filter(Boolean));
  const about = programIds.size === 1 ? c.programs.find((p) => programIds.has(p.id))?.description ?? null : null;
  return {
    items,
    groups: mine.map((g) => ({ name: g.name, when: meetingLabel(g), day: g.meets_weekday })),
    today: weekday,
    more: allowed ? { left, why } : null,
    about,
    schedule: (() => {
      const s = c.schedules.find((x) => x.user_id === v.user!.id);
      return s ? { club: s.club_days, game: s.game_day } : null;
    })(),
  };
});

/** Their trainer, as a player sees them (0018). Both null until that migration runs. */
export type Trainer = { name: string | null; photo: string | null };

/**
 * Where a player stands with their trainer, so each screen can say the right
 * thing instead of showing an empty week:
 *
 *   none     signed out, not a member here, or staff: the pages as they are
 *   new      joined in the last two weeks and hasn't done a trainer session
 *   waiting  nothing set this week, and not new
 *   active   something set this week still to do
 *   done     everything set this week is done
 */
export type PlayerState =
  | { kind: 'none' }
  | { kind: 'new' | 'waiting'; week: MyWeek; trainer: Trainer }
  | { kind: 'active' | 'done'; week: MyWeek };

/** How long after joining, with nothing done, a player still reads as new. */
const NEW_FOR_DAYS = 14;

export const getPlayerState = cache(async (): Promise<PlayerState> => {
  const v = await getViewer();
  if (!v.academy || !v.user || v.role !== 'player') return { kind: 'none' };
  const week = await readMyWeek();
  if (!week) return { kind: 'none' };
  if (week.items.length) return { kind: week.items.every((i) => i.done) ? 'done' : 'active', week };
  const [trainer, joined, everDone] = await Promise.all([
    getTrainer(),
    v.db.from('academy_members').select('joined_at').eq('academy_id', v.academy.id).eq('user_id', v.user.id).maybeSingle(),
    v.db.from('workouts').select('id', { count: 'exact', head: true })
      .eq('user_id', v.user.id).eq('status', 'completed').in('source', ['academy', 'addon']),
  ]);
  const joinedAt = Date.parse(joined.data?.joined_at ?? '');
  const recent = Number.isNaN(joinedAt) || Date.now() - joinedAt < NEW_FOR_DAYS * 86400000;
  return { kind: recent && !everDone.count ? 'new' : 'waiting', week, trainer };
});

/** This academy's trainer, for a signed-in member; nameless and faceless otherwise. Once per render. */
export const getTrainer = cache(async (): Promise<Trainer> => {
  const v = await getViewer();
  if (!v.academy || !v.user) return { name: null, photo: null };
  const { data, error } = await v.db.rpc('academy_trainer', { p_academy: v.academy.id });
  if (error || !data) return { name: null, photo: null };
  const t = data as { name: string | null; photo_at: string | null };
  return { name: t.name ?? null, photo: t.photo_at ? `/me/trainer-photo?v=${encodeURIComponent(t.photo_at)}` : null };
});
