'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { localDate, mondayOf } from '@/lib/progress';

type Result = { ok: true } | { ok: false; error: string };
const days = (xs: unknown[]) => [...new Set(xs.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
const NOT_YET = 'Soccer days aren’t switched on yet (migration 0008).';

/**
 * A player's soccer days: club training, and a game day. Saved for the
 * player themselves, or, from the trainer area, for one of a trainer's
 * players (`userId`); RLS checks either way.
 */
export async function saveSoccerDays(input: { club: number[]; game: number | null; userId?: string }): Promise<Result> {
  const v = await getViewer();
  if (!v.user) return { ok: false, error: 'Sign in first.' };
  const target = input.userId && v.staff ? input.userId : v.user.id;
  const club = days(input.club);
  const game = input.game === null ? null : days([input.game])[0] ?? null;
  const { error } = await v.db.from('player_schedules').upsert({
    user_id: target, club_days: club.filter((d) => d !== game), game_day: game, updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: /player_schedules/.test(error.message) ? NOT_YET : error.message };
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
  if (weekday === undefined || !/^[sa]:[0-9a-f-]{36}$/.test(input.key)) return { ok: false, error: 'That day doesn’t work.' };
  const week_of = mondayOf(localDate(new Date(), v.academy.timeZone));
  const row = { user_id: v.user.id, academy_id: v.academy.id, week_of, item_key: input.key };
  const { error } = weekday === input.placed
    ? await v.db.from('session_moves').delete().match(row)
    : await v.db.from('session_moves').upsert({ ...row, weekday });
  if (error) return { ok: false, error: /session_moves/.test(error.message) ? NOT_YET : error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}
