'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { localDate, mondayOf, weekdayOf } from '@/lib/progress';
import type { TeamDays } from '@/lib/academy-week';
import { plain } from '@/lib/plain-error';

type Result = { ok: true } | { ok: false; error: string };
const days = (xs: unknown[]) => [...new Set(xs.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
const NOT_YET = 'Soccer days aren’t switched on yet. Try again later.';
const NOT_YET_0021 = 'Trainer days and more than one game aren’t switched on yet. Try again later.';

/**
 * A player's soccer days: with their trainer, team practice, and games. A
 * day is one of them at most; the game wins, then the trainer. Saved for the
 * player themselves, or, from the trainer area, for one of a trainer's
 * players (`userId`); RLS checks either way.
 *
 * game_day is still written, as the first game, for anything reading it from
 * before 0021. Before 0021 runs, a week with one game and no trainer days
 * still saves.
 */
export async function saveSoccerDays(input: TeamDays & { userId?: string }): Promise<Result> {
  const v = await getViewer();
  if (!v.user) return { ok: false, error: 'Sign in first.' };
  // Someone else's days only from the trainer area; anyone else asking for
  // that is told no, rather than having it saved to their own week.
  if (input.userId && input.userId !== v.user.id && !v.staff) return { ok: false, error: 'Only trainers can do that.' };
  const target = input.userId ?? v.user.id;
  const games = days(input.games);
  const trainer = days(input.trainer).filter((d) => !games.includes(d));
  const practice = days(input.practice).filter((d) => !games.includes(d) && !trainer.includes(d));
  const row = { user_id: target, club_days: practice, game_day: games[0] ?? null, updated_at: new Date().toISOString() };
  let { error } = await v.db.from('player_schedules').upsert({ ...row, game_days: games, trainer_days: trainer });
  if (error && /game_days|trainer_days/.test(error.message)) {
    if (games.length > 1 || trainer.length) return { ok: false, error: NOT_YET_0021 };
    ({ error } = await v.db.from('player_schedules').upsert(row));
  }
  if (error) return { ok: false, error: /player_schedules/.test(error.message) ? NOT_YET : plain(error) };
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * This week only: one of the trainer's items, on another day. Moving it back
 * to where the app put it just clears the move.
 */
export async function moveItem(input: { key: string; weekday: number; placed: number }): Promise<Result> {
  const v = await getViewer();
  if (!v.user || !v.academy) return { ok: false, error: 'Sign in first.' };
  const weekday = days([input.weekday])[0];
  // s: a program's session, a: a trainer's extra, c: a week built for them
  // or a session they added. buildWeek applies a move to any of them by key.
  if (weekday === undefined || !/^[sac]:[0-9a-f-]{36}$/.test(input.key)) return { ok: false, error: 'That day doesn’t work.' };
  const today = localDate(new Date(), v.academy.timeZone);
  const week_of = mondayOf(today);
  // Not onto a day that's gone (it would only read as missed). Back to where
  // the app put it is always fine.
  if (weekday !== input.placed && weekday < weekdayOf(today)) return { ok: false, error: 'That day’s gone. Pick today or later.' };
  const row = { user_id: v.user.id, academy_id: v.academy.id, week_of, item_key: input.key };
  const { error } = weekday === input.placed
    ? await v.db.from('session_moves').delete().match(row)
    : await v.db.from('session_moves').upsert({ ...row, weekday });
  if (error) return { ok: false, error: /session_moves/.test(error.message) ? NOT_YET : plain(error) };
  revalidatePath('/', 'layout');
  return { ok: true };
}
