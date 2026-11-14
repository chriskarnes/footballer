import 'server-only';
import { cache } from 'react';
import { addDays, localDate } from './progress';
import { getViewer } from './viewer';

export type InboxNote = { id: string; body: string; kind: string; author: string; at: string; seen: boolean };

/**
 * The signed-in player's notes from this academy, newest first. RLS limits
 * the rows to their own; the academy filter keeps a player who has moved on
 * from seeing an old trainer's notes at a new address.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readInbox(db: any, userId: string, academyId: string, limit = 50, unreadOnly = false): Promise<InboxNote[]> {
  // Newest first before the limit, by the note's own date. ordering on the
  // embed (referencedTable) only sorted inside each row: the limit took the
  // oldest, and from about the twentieth note new ones never showed.
  let q = db.from('note_recipients')
    .select('seen_at, notes!inner(id, body, kind, author_name, created_at, academy_id)')
    .eq('user_id', userId).eq('notes.academy_id', academyId);
  if (unreadOnly) q = q.is('seen_at', null);
  const { data, error } = await q.order('notes(created_at)', { ascending: false }).limit(limit);
  if (error || !data) return [];
  return (data as { seen_at: string | null; notes: { id: string; body: string; kind: string; author_name: string; created_at: string } }[])
    .map((r) => ({ id: r.notes.id, body: r.notes.body, kind: r.notes.kind, author: r.notes.author_name, at: r.notes.created_at, seen: !!r.seen_at }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * "just now", "2 h ago", "yesterday", "Mon, Nov 3". On the academy's calendar
 * (`tz`): this runs on the server, whose clock is UTC, so an evening note in
 * New York used to be dated the next day, and "yesterday" was any 24 to 48
 * hours rather than the day before.
 */
export function ago(at: string, tz = 'UTC', now = Date.now()) {
  const mins = Math.round((now - Date.parse(at)) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const day = localDate(at, tz), today = localDate(new Date(now), tz);
  if (day === today) return `${Math.round(mins / 60)} h ago`;
  if (day === addDays(today, -1)) return 'yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }).format(new Date(at));
}

/**
 * The signed-in player's unread notes here, newest first; empty for anyone
 * who isn't a player. Once per render, so Train's band and the note banner
 * share one read.
 */
export const getUnread = cache(async (): Promise<InboxNote[]> => {
  try {
    const v = await getViewer();
    if (!v.user || !v.academy || v.role !== 'player') return [];
    return await readInbox(v.db, v.user.id, v.academy.id, 20, true);
  } catch {
    return [];
  }
});
