'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/viewer';
import { LEGAL_UPDATED, CONTACT_EMAIL } from '@/lib/legal';
import { LINK_DAYS, looksLikeEmail, shortName } from '@/lib/child';
import { hashToken, myConsentGate, newToken, playerAcademies, staffSomewhere } from '@/lib/consent-server';
import { requestEmail } from '@/lib/consent-email';
import { sendEmail } from '@/lib/email';
import { serviceDb } from '@/lib/service-db';
import { rootHref } from '@/lib/root-link';
import { playerSubscriptions, stopSubscriptions } from '@/lib/billing-server';

type Result = { ok: true } | { ok: false; error: string };

const LATER = 'That isn’t switched on yet. Try again later.';
const FAILED = 'Couldn’t save that. Try again.';

/**
 * A parent or guardian, signed in with their own email (they joined as a
 * parent), agrees for their player under 13 (0043). The confirmation email
 * follows a day later, from the daily clean-up.
 */
export async function agreeHere(): Promise<Result> {
  const v = await getViewer();
  const gate = await myConsentGate();
  if (!v.user || gate?.how !== 'here') return { ok: false, error: 'There’s nothing to agree to here.' };
  const db = serviceDb();
  if (!db) return { ok: false, error: LATER };
  const { error } = await db.from('parent_consents').upsert({
    user_id: v.user.id, parent_email: v.user.email ?? null, agreed_at: new Date().toISOString(),
    method: 'in_app', notice_version: LEGAL_UPDATED, token_hash: null,
  }, { onConflict: 'user_id' });
  if (error) { console.error('agreeHere', error); return { ok: false, error: FAILED }; }
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * A player under 13 whose account isn't a parent's asks one: the parent or
 * guardian is emailed a link that works for LINK_DAYS days. Their address is
 * used for this and the confirmation, nothing else.
 */
export async function askParent(email: string): Promise<Result> {
  const v = await getViewer();
  const gate = await myConsentGate();
  if (!v.user || gate?.how !== 'email') return { ok: false, error: 'There’s nothing to ask for here.' };
  const to = email.trim().toLowerCase();
  if (!looksLikeEmail(to)) return { ok: false, error: 'That doesn’t look like an email address.' };
  if (to === (v.user.email ?? '').toLowerCase()) return { ok: false, error: 'Use a parent’s or guardian’s own email, not the one this account signs in with.' };
  const db = serviceDb();
  if (!db) return { ok: false, error: LATER };

  const { data: was } = await db.from('parent_consents').select('requested_at').eq('user_id', v.user.id).maybeSingle();
  const last = was?.requested_at ? Date.parse(was.requested_at as string) : 0;
  if (Date.now() - last < 2 * 60_000) return { ok: false, error: 'Sent a moment ago. Check that inbox, and its spam folder.' };

  const { token, hash } = newToken();
  const { error } = await db.from('parent_consents').upsert({
    user_id: v.user.id, parent_email: to, token_hash: hash, requested_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) { console.error('askParent', error); return { ok: false, error: FAILED }; }

  const h = await headers();
  const here = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const { data: prof } = await v.db.from('profiles').select('display_name').eq('id', v.user.id).maybeSingle();
  const sent = await sendEmail(requestEmail({
    to, player: shortName(prof?.display_name as string | null).split(' ')[0],
    academies: await playerAcademies(db, v.user.id),
    link: `${here}/consent/${token}`, privacy: await rootHref('/privacy'), contact: CONTACT_EMAIL,
  }));
  if (!sent) return { ok: false, error: 'Couldn’t send the email just now. Try again in a minute.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** The request a link is for, while it still works. */
async function byLink(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = serviceDb();
  if (!db) return null;
  const hash = hashToken(token);
  const { data } = await db.from('parent_consents').select('user_id, requested_at, agreed_at').eq('token_hash', hash).maybeSingle();
  const row = data as { user_id: string; requested_at: string | null; agreed_at: string | null } | null;
  if (!row?.requested_at || Date.now() - Date.parse(row.requested_at) > LINK_DAYS * 86_400_000) return null;
  return { db, hash, row };
}

const GONE = 'This link has expired or was already used. Ask your player to send a new one.';

/** The parent or guardian, from the emailed link: yes. */
export async function agreeByLink(token: string): Promise<Result> {
  const found = await byLink(token);
  if (!found) return { ok: false, error: GONE };
  const { error } = await found.db.from('parent_consents')
    .update({ agreed_at: new Date().toISOString(), method: 'email_link', notice_version: LEGAL_UPDATED, token_hash: null })
    .eq('user_id', found.row.user_id).eq('token_hash', found.hash);
  if (error) { console.error('agreeByLink', error); return { ok: false, error: FAILED }; }
  return { ok: true };
}

/** The parent or guardian, from the emailed link: no. The account and everything in it goes now. */
export async function declineByLink(token: string): Promise<Result> {
  const found = await byLink(token);
  if (!found) return { ok: false, error: GONE };
  const id = found.row.user_id;
  // Never a trainer's account: those aren't asked, so a link for one is wrong.
  if (await staffSomewhere(found.db, id)) return { ok: false, error: `Couldn’t do that from here. ${CONTACT_EMAIL ? `Write to ${CONTACT_EMAIL}` : 'Write to us'} and we’ll delete it.` };
  // Card payments are found before the account goes, and stopped once it has.
  const subs = await playerSubscriptions(id);
  if (!subs) return { ok: false, error: 'Couldn’t check for card payments, so nothing was deleted. Try again in a minute.' };
  const { error } = await found.db.auth.admin.deleteUser(id);
  if (error) { console.error('declineByLink', error); return { ok: false, error: 'Couldn’t delete it. Try again.' }; }
  await stopSubscriptions(subs);
  return { ok: true };
}
