/**
 * Players under 13, and what the app keeps about them (COPPA). Nothing here
 * reads the database: the rules, so the pages, the API and the tests agree.
 *
 * The app asks an age range, never a birthday, and two ranges are under 13.
 * For those players a parent or guardian agrees before training, and the app
 * keeps less: no photo, no club or area, and (for every player) a first name
 * and last initial, never a full name.
 */

/** The age ranges the app asks for, in order. */
export const AGE_BANDS: [string, string][] = [
  ['u10', 'Under 10'], ['10_12', '10–12'], ['13_15', '13–15'],
  ['16_18', '16–17'], ['18_plus', '18+'],
];

export const UNDER_13_BANDS = ['u10', '10_12'];

export const isUnder13 = (band: string | null | undefined) => !!band && UNDER_13_BANDS.includes(band);

/**
 * A player's name as it's kept: the first name and the last name's initial
 * ("Jack Morris" is kept as "Jack M."). A first and last name together is
 * personal information under COPPA; a first name and an initial still tells
 * a trainer's two Jacks apart.
 */
export function shortName(raw: string | null | undefined): string {
  const words = (raw ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const first = words[0].slice(0, 40);
  if (words.length === 1) return first;
  const last = words[words.length - 1].replace(/[^\p{L}\p{N}]/gu, '');
  return last ? `${first} ${last[0].toLocaleUpperCase()}.` : first;
}

/**
 * The sample players the seed scripts make (kestrel-*@train.futbol): the
 * platform's own addresses, which nobody signs in with. Nobody's child, so
 * never asked for a parent's agreement and never cleaned up.
 */
export const isSampleEmail = (email: string | null | undefined) => !!email && /@train\.futbol$/i.test(email.trim());

/** Request emails one account can send a parent or guardian in a day (0044). */
export const REQUESTS_PER_DAY = 3;

/**
 * How many request emails an account has sent in its current day (0044),
 * and whether a new day starts with this one: the day runs from the first
 * request, not from midnight.
 */
export function requestsToday(row: { requests_sent?: number | null; requests_since?: string | null } | null, now = Date.now()) {
  const since = row?.requests_since ? Date.parse(row.requests_since) : NaN;
  const fresh = !Number.isFinite(since) || now - since >= 86_400_000;
  return { fresh, sent: fresh ? 0 : Math.max(0, row?.requests_sent ?? 0) };
}

/** Days a parent or guardian has to agree before an under-13 account is deleted. */
export const CONSENT_DAYS = 30;
/** Days a player's account can go unused (no sign-in, no training) before it's deleted. */
export const INACTIVE_DAYS = 365;
/** Hours after agreeing that the confirmation email goes. */
export const CONFIRM_AFTER_HOURS = 24;
/** Days an emailed agreement link works. */
export const LINK_DAYS = 14;

/**
 * Whether this account needs a parent's or guardian's agreement before
 * training, and how it's given:
 *   here   the account is the parent's own (they signed up as a parent, or
 *          a trainer elsewhere is here for their own child): they agree in
 *          the app, signed in with their own email.
 *   email  anyone else: a parent or guardian is emailed a link. Only once
 *          the app can send email; until then nobody is asked.
 * Null when it doesn't apply: 13 or over, staff, a sample account, or agreed.
 */
export type ConsentNeed = null | { how: 'here' | 'email' };

export function consentNeed(p: {
  ageBand: string | null | undefined;
  email: string | null | undefined;
  /** A trainer or owner of the academy this is on. */
  staffHere: boolean;
  /** Joined as a parent (profiles.signed_up_by), or staff at another academy. */
  parentHeld: boolean;
  agreed: boolean;
  canEmail: boolean;
}): ConsentNeed {
  if (p.staffHere || p.agreed || !isUnder13(p.ageBand) || isSampleEmail(p.email)) return null;
  if (p.parentHeld) return { how: 'here' };
  return p.canEmail ? { how: 'email' } : null;
}

/** A rough check that something is an email address, before it's sent anything. */
export const looksLikeEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 200;
