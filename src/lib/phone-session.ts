/**
 * Who's signed in on this phone, as far as the phone can tell.
 *
 * The sign-in is renewed every hour. With no signal it can't be, and the
 * auth client then answers "no session" with an error, though the sign-in is
 * still on the phone and works again once there's signal. That is not a
 * sign-out, and reading it as one emptied the offline cache and the player's
 * things on the phone at a field with no signal. So there are three answers,
 * not two:
 *
 *   in       signed in, and this is who
 *   out      nobody is signed in
 *   unknown  couldn't tell: a sign-in that can't be renewed right now, or
 *            accounts aren't set up. Change nothing on the strength of it.
 */
import { browserClient } from './supabase/client';

export type Here = { state: 'in'; uid: string } | { state: 'out' } | { state: 'unknown' };

/** Reads what the auth client's getSession() handed back. */
export function readSession(r: { data?: { session?: { user?: { id?: string } | null } | null } | null; error?: unknown } | null | undefined): Here {
  const uid = r?.data?.session?.user?.id;
  if (uid) return { state: 'in', uid };
  // No session and an error: it couldn't be renewed, which isn't signed out.
  if (!r || r.error) return { state: 'unknown' };
  return { state: 'out' };
}

/** Never throws. */
export async function whoIsHere(): Promise<Here> {
  try {
    return readSession(await browserClient().auth.getSession());
  } catch {
    return { state: 'unknown' };   // not configured, or storage blocked
  }
}

const LAST = 'forge.lastUser';

/** The account last seen signed in on this phone (kept by notePageCacheUser), or null. */
export function lastUser(): string | null {
  try { return localStorage.getItem(LAST); } catch { return null; }
}

/**
 * Whose work this is, when it can't be sent now. The phone's sign-in; else
 * the player the page was opened for; else, when the phone's sign-in is only
 * unreachable, the account last signed in here. Null only when it really is
 * nobody's.
 */
export function ownerOf(here: Here, pageOwner: string | null | undefined, last: string | null): string | null {
  if (here.state === 'in') return here.uid;
  return pageOwner ?? (here.state === 'unknown' ? last : null);
}
