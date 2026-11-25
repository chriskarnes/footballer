/**
 * What the sign-in card says when Supabase turns a request down for being
 * one too many. Three limits answer with the same status (429), and someone
 * can only act on the one they're told about:
 *   - this address was sent a code under a minute ago (per address): wait
 *     a minute;
 *   - this network has asked a lot in a few minutes (per IP address, so a
 *     team on one Wi-Fi shares it): wait, or use mobile data;
 *   - the app has sent all the sign-in emails it may for now (per hour, for
 *     everyone, set in Supabase under Authentication → Rate Limits): wait a
 *     few minutes, and tell us if it keeps happening, since nothing else
 *     will.
 * The first and the last come back with the same code
 * (over_email_send_rate_limit); the per-address one is the one whose message
 * counts seconds ("…only request this after 42 seconds"). Null for anything
 * that isn't a limit.
 */
export type AuthFailure = { status?: number; code?: string; message?: string };

export const JUST_SENT = 'A code was just sent. Wait a minute, then try again.';
export const BUSY_NETWORK = 'Lots of sign-ins from this network just now. Wait a few minutes and try again, or switch to mobile data.';
export const TOO_MANY = 'Too many tries just now. Wait a few minutes and try again.';
export const emailsPaused = (contact: string | null) =>
  'Lots of sign-in emails just went out, so new ones are paused for a few minutes. Try again soon.'
  + (contact ? ` If it keeps happening, write to ${contact}.` : '');

export function limitMessage(e: AuthFailure, contact: string | null = null): string | null {
  const msg = e.message ?? '';
  const perAddress = /seconds/i.test(msg);
  if (e.code === 'over_request_rate_limit') return BUSY_NETWORK;
  if (e.code === 'over_email_send_rate_limit' || /email rate limit/i.test(msg)) return perAddress ? JUST_SENT : emailsPaused(contact);
  if (e.status === 429) return perAddress ? JUST_SENT : TOO_MANY;
  return null;
}
