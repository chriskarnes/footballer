/**
 * What a person is told when something fails, instead of the database's own
 * words ("violates row-level security policy…", "Run migration 0013…"). The
 * real error goes to the server log, where it can be looked into; the person
 * gets a sentence they can act on.
 */
export const COULDNT_SAVE = 'Couldn’t save that. Try again.';
export const NOT_READY = 'That isn’t switched on yet. Try again later.';

/** An error whose message was written for the person reading it. */
export class Said extends Error {}

/** Logs the raw error and returns plain words for it. */
export function plain(raw: unknown, say = COULDNT_SAVE): string {
  if (raw instanceof Said) return raw.message;
  console.error(raw);
  return say;
}

/** A part of the database that hasn't been set up yet: logged with which update it needs. */
export function notReady(raw: unknown, migration: string): string {
  console.error(`needs migration ${migration}:`, raw);
  return NOT_READY;
}

/** What a tap says when the request never reached us: a thrown fetch, no signal. */
export const NO_SIGNAL = 'Couldn’t reach us. Check your signal and try again.';

/**
 * For a catch around a server action: a redirect or notFound from the action
 * is Next's to handle, not a failure, so it goes back up.
 */
export function unlessNext(e: unknown): void {
  if (e && typeof e === 'object' && 'digest' in e && /^NEXT_/.test(String((e as { digest: unknown }).digest))) throw e;
}

/**
 * `.catch(offline)` on a server action called from a tap: a thrown call (no
 * signal, a deploy mid-flight) becomes an ordinary failed result, so the page
 * says so instead of crashing. A redirect still goes through.
 */
export function offline(e: unknown): { ok: false; error: string } {
  unlessNext(e);
  return { ok: false, error: NO_SIGNAL };
}

/** The same for a form's action under useActionState: wrap it once, at module level. */
export function guarded<R>(fn: (prev: unknown, f: FormData) => Promise<R>) {
  return async (prev: unknown, f: FormData): Promise<R | { ok: false; error: string }> => {
    try { return await fn(prev, f); } catch (e) { return offline(e); }
  };
}
