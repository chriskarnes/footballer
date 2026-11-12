/**
 * When a finished session was, in words.
 *
 * Run in the browser for the same reason as plan-today.ts: "yesterday" is the
 * player's local calendar, not the server's UTC.
 *
 * Framework-free, like the builders.
 */

const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** A local calendar day as a sortable key: the time of its midnight. */
const dayKey = (iso: string) => dayStart(new Date(iso)).getTime();

/** "Today", "Yesterday", a weekday within the week, else a short date. */
export function relativeDay(iso: string, now = new Date()): string {
  const days = Math.round((dayStart(now).getTime() - dayKey(iso)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const d = new Date(iso);
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short',
    ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });
}
