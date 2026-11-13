'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { plain, notReady } from '@/lib/plain-error';

type Result = { ok: true } | { ok: false; error: string };

const missing = (m: string) => /function .* does not exist|Could not find the function|column .* does not exist/i.test(m);

/**
 * Step one of setup: the owner's name as players see it, and the academy's
 * time zone (weeks start on its Monday). Their photo saves on its own, from
 * the picker.
 */
export async function saveYou(name: string, timeZone: string): Promise<Result> {
  const v = await getViewer();
  if (!v.user || !v.academy || v.role !== 'owner') return { ok: false, error: 'Only the owner sets this up.' };
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n || n.length > 60) return { ok: false, error: 'Write your name, as your players say it.' };
  // Any zone the browser offered, even one this server's list names differently.
  try { new Intl.DateTimeFormat('en', { timeZone }); } catch { return { ok: false, error: 'Pick your time zone from the list.' }; }

  const [p, a] = await Promise.all([
    v.db.from('profiles').upsert({ id: v.user.id, display_name: n }),
    v.db.from('academies').update({ time_zone: timeZone, updated_at: new Date().toISOString(), updated_by: v.user.id })
      .eq('id', v.academy.id),
  ]);
  if (p.error) return { ok: false, error: plain(p.error) };
  if (a.error) return { ok: false, error: plain(a.error) };
  const { error } = await v.db.rpc('academy_setup_mark', { p_academy: v.academy.id, p_step: 'you' });
  if (error) return { ok: false, error: missing(error.message) ? notReady(error, '0020') : plain(error) };
  revalidatePath('/coach/setup');
  return { ok: true };
}

/**
 * A trainer's name as their players see it, for anyone on the staff: an
 * invited trainer is asked on the dashboard, since setup is the owner's.
 */
export async function saveName(name: string): Promise<Result> {
  const v = await getViewer();
  if (!v.user || !v.academy || !v.staff) return { ok: false, error: 'Sign in as a trainer first.' };
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n || n.length > 60) return { ok: false, error: 'Write your name, as your players say it.' };
  const { error } = await v.db.from('profiles').upsert({ id: v.user.id, display_name: n });
  if (error) return { ok: false, error: plain(error) };
  revalidatePath('/coach');
  return { ok: true };
}

/** The last step: the checklist goes, and the academy shows in Find your trainer. */
export async function finishSetup(): Promise<Result> {
  const v = await getViewer();
  if (!v.user || !v.academy || v.role !== 'owner') return { ok: false, error: 'Only the owner sets this up.' };
  const { error } = await v.db.rpc('academy_setup_mark', { p_academy: v.academy.id, p_step: 'done' });
  if (error) return { ok: false, error: missing(error.message) ? notReady(error, '0020') : plain(error) };
  revalidatePath('/coach');
  redirect('/coach?ready=1');
}
