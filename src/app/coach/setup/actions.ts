'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, updateTag } from 'next/cache';
import { academyTag } from '@/lib/branding-server';
import { readSetup, setupSteps } from '@/lib/setup';
import { loadContent } from '@/lib/academy-data';
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
  // The academy row is cached: without this, weeks and program start dates
  // keep using the old time zone for up to five minutes.
  updateTag(academyTag(v.academy.slug));
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

/** Whether players can find the academy by name in Find your trainer. The owner's choice. */
export async function setListed(listed: boolean): Promise<Result> {
  const v = await getViewer();
  if (!v.user || !v.academy || v.role !== 'owner') return { ok: false, error: 'Only the owner can change this.' };
  const { error } = await v.db.from('academies').update({ listed }).eq('id', v.academy.id);
  if (error) return { ok: false, error: plain(error) };
  revalidatePath('/coach', 'layout');
  return { ok: true };
}

/**
 * The last step: the checklist goes, and, unless the owner would rather
 * only their invite link brought players in, the academy shows in Find
 * your trainer.
 */
export async function finishSetup(listed = true): Promise<Result> {
  const v = await getViewer();
  if (!v.user || !v.academy || v.role !== 'owner') return { ok: false, error: 'Only the owner sets this up.' };
  // The first four steps, checked here too: the disabled button is only the page's say.
  const [setup, content] = await Promise.all([readSetup(v.db, v.academy.id), loadContent(v.db, v.academy.id)]);
  if (setupSteps(setup, content).slice(0, 4).some((x) => !x)) {
    return { ok: false, error: 'Finish the steps above first.' };
  }
  // Done and listed (or not) in one statement (0023), so a failed second
  // write can't leave an academy listed that its owner kept to the link.
  const { error } = await v.db.rpc('academy_setup_finish', { p_academy: v.academy.id, p_listed: listed });
  if (error && missing(error.message)) {
    // Before 0023: the old way, done (which lists it) and then back out.
    const r = await v.db.rpc('academy_setup_mark', { p_academy: v.academy.id, p_step: 'done' });
    if (r.error) return { ok: false, error: missing(r.error.message) ? notReady(r.error, '0020') : plain(r.error) };
    if (!listed) {
      const u = await v.db.from('academies').update({ listed: false }).eq('id', v.academy.id);
      if (u.error) return { ok: false, error: plain(u.error) };
    }
  } else if (error) return { ok: false, error: plain(error) };
  updateTag(academyTag(v.academy.slug));
  revalidatePath('/coach');
  redirect(`/coach?ready=${listed ? 'listed' : 'link'}`);
}
