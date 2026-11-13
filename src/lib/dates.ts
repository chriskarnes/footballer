/**
 * A date as the app writes it: "Nov 13", in US order, everywhere. Read the
 * same on the server and in the browser — a locale default rendered
 * "13/11/2026" in one and "11/13/2026" in the other.
 *
 * Takes a day (2026-11-13), as stored for start dates and test days, or a
 * timestamp. A day is read at noon UTC so no time zone moves it.
 */
export function shortDate(iso: string): string {
  const d = /^\d{4}-\d\d-\d\d$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
