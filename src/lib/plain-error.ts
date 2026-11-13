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
