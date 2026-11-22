import { NextResponse } from 'next/server';
import { CONFIRM_AFTER_HOURS, CONSENT_DAYS, INACTIVE_DAYS, UNDER_13_BANDS, isSampleEmail, shortName } from '@/lib/child';
import { confirmEmail, longDate } from '@/lib/consent-email';
import { emailOn, sendEmail } from '@/lib/email';
import { CONTACT_EMAIL } from '@/lib/legal';
import { serviceDb, notMadeYet } from '@/lib/service-db';
import { ROOT_DOMAIN } from '@/lib/tenant';
import { playerSubscriptions, stopSubscriptions } from '@/lib/billing-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAY = 86_400_000;
/** At most this many accounts deleted for each reason in one run: a mistake stays small. */
const MAX_DELETES = 25;

/**
 * Once a day (vercel.json), what the privacy policy promises happens on its
 * own (0043):
 *   1. The confirmation email to each parent or guardian who agreed a day
 *      or more ago.
 *   2. The 30 days start for each player under 13 who's being asked for an
 *      agreement and isn't counted yet.
 *   3. Players under 13 nobody agreed for within 30 days: deleted.
 *   4. Players' accounts unused for a year: deleted.
 * Never a trainer's or an admin's account, never one still paying, never a
 * sample account. Vercel calls it with CRON_SECRET; nobody else can.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'no' }, { status: 401 });
  const db = serviceDb();
  if (!db) return NextResponse.json({ error: 'not set up' }, { status: 503 });

  const done = { confirmed: 0, counting: 0, unagreedDeleted: 0, inactiveDeleted: 0, held: [] as string[], errors: [] as string[] };
  const step = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { console.error(`cron daily: ${name}`, e); done.errors.push(name); }
  };

  await step('confirm', () => confirmations(db, done));
  await step('count', () => startCounting(db, done));
  await step('unagreed', () => deleteUnagreed(db, done));
  await step('inactive', () => deleteInactive(db, done));

  console.log('cron daily', JSON.stringify(done));
  return NextResponse.json(done, { status: done.errors.length ? 500 : 200 });
}

type Done = { confirmed: number; counting: number; unagreedDeleted: number; inactiveDeleted: number; held: string[]; errors: string[] };

/** The first name, the account's email, and whether it's staff anywhere. */
async function who(db: SupabaseClient, id: string) {
  const [{ data: prof }, { data: staff }, { data: u }] = await Promise.all([
    db.from('profiles').select('display_name, age_band').eq('id', id).maybeSingle(),
    db.from('academy_members').select('role').eq('user_id', id).in('role', ['owner', 'trainer']).limit(1),
    db.auth.admin.getUserById(id),
  ]);
  return {
    first: shortName((prof as { display_name: string | null } | null)?.display_name).split(' ')[0],
    ageBand: (prof as { age_band: string | null } | null)?.age_band ?? null,
    staff: !!staff?.length,
    email: u?.user?.email ?? null,
  };
}

async function confirmations(db: SupabaseClient, done: Done) {
  if (!emailOn()) return;
  const before = new Date(Date.now() - CONFIRM_AFTER_HOURS * 3_600_000).toISOString();
  const { data, error } = await db.from('parent_consents').select('user_id, parent_email, agreed_at, method')
    .not('agreed_at', 'is', null).lte('agreed_at', before).is('confirm_sent_at', null).not('parent_email', 'is', null).limit(50);
  if (error) { if (notMadeYet(error)) return; throw error; }
  for (const r of (data ?? []) as { user_id: string; parent_email: string; agreed_at: string; method: string | null }[]) {
    if (r.method === 'sample') continue;
    const w = await who(db, r.user_id);
    const sent = await sendEmail(confirmEmail({
      to: r.parent_email, player: w.first, agreedOn: longDate(r.agreed_at),
      accountEmail: w.email, privacy: `https://${ROOT_DOMAIN}/privacy`, contact: CONTACT_EMAIL,
    }));
    if (!sent) continue;
    await db.from('parent_consents').update({ confirm_sent_at: new Date().toISOString() }).eq('user_id', r.user_id);
    done.confirmed++;
  }
}

/**
 * Players under 13 who are being asked and aren't counted yet: the clock
 * starts today. Only where they can actually be asked (the same rule as
 * the screen): a parent's own account, or anyone once email is set up.
 */
async function startCounting(db: SupabaseClient, done: Done) {
  const { data: kids, error } = await db.from('profiles').select('id, signed_up_by').in('age_band', UNDER_13_BANDS).limit(1000);
  if (error) throw error;
  const ids = (kids ?? []).map((k) => k.id as string);
  if (!ids.length) return;
  const { data: rows, error: re } = await db.from('parent_consents').select('user_id').in('user_id', ids);
  if (re) { if (notMadeYet(re)) return; throw re; }
  const counted = new Set((rows ?? []).map((r) => r.user_id as string));
  for (const k of (kids ?? []) as { id: string; signed_up_by: string | null }[]) {
    if (counted.has(k.id)) continue;
    const w = await who(db, k.id);
    if (w.staff || isSampleEmail(w.email)) continue;
    // Only accounts that are players somewhere are asked.
    const { data: member } = await db.from('academy_members').select('user_id').eq('user_id', k.id).eq('role', 'player').limit(1);
    if (!member?.length) continue;
    if (k.signed_up_by !== 'parent' && !emailOn()) continue;
    const { error: ie } = await db.from('parent_consents').insert({ user_id: k.id, first_asked_at: new Date().toISOString() });
    if (!ie) done.counting++;
  }
}

/** Deletes an account the way Delete account does, card payments stopped after. False if it was held back. */
async function remove(db: SupabaseClient, id: string, why: string, done: Done): Promise<boolean> {
  const subs = await playerSubscriptions(id);
  if (!subs) { done.held.push(`${why}: ${id} (payments unreadable)`); return false; }
  if (subs.some((s) => s.status && !['canceled', 'incomplete_expired'].includes(s.status))) {
    // Someone's paying: a person looks at it, not a job.
    done.held.push(`${why}: ${id} (still paying)`);
    return false;
  }
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) { done.held.push(`${why}: ${id} (${error.message})`); return false; }
  await stopSubscriptions(subs);
  console.log(`cron daily: deleted ${id} (${why})`);
  return true;
}

async function deleteUnagreed(db: SupabaseClient, done: Done) {
  const before = new Date(Date.now() - CONSENT_DAYS * DAY).toISOString();
  const { data, error } = await db.from('parent_consents').select('user_id').is('agreed_at', null).lt('first_asked_at', before).limit(MAX_DELETES);
  if (error) { if (notMadeYet(error)) return; throw error; }
  for (const { user_id: id } of (data ?? []) as { user_id: string }[]) {
    const w = await who(db, id);
    // Grown up since, or a trainer now, or a sample: not this rule's to delete.
    if (w.staff || isSampleEmail(w.email) || !UNDER_13_BANDS.includes(w.ageBand ?? '')) {
      if (!w.staff && !isSampleEmail(w.email)) await db.from('parent_consents').delete().eq('user_id', id).is('agreed_at', null);
      continue;
    }
    if (await remove(db, id, 'no agreement', done)) done.unagreedDeleted++;
  }
}

async function deleteInactive(db: SupabaseClient, done: Done) {
  const before = new Date(Date.now() - INACTIVE_DAYS * DAY).toISOString();
  const { data, error } = await db.rpc('inactive_players', { p_before: before, p_limit: MAX_DELETES });
  if (error) { if (error.code === 'PGRST202' || notMadeYet(error)) return; throw error; }
  for (const { user_id: id } of (data ?? []) as { user_id: string }[]) {
    if (await remove(db, id, 'unused for a year', done)) done.inactiveDeleted++;
  }
}
