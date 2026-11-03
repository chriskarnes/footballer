/**
 * Just enough RFC 5545 to publish a read-only calendar feed.
 *
 * Hand-written rather than a dependency because the subset is small and the
 * three things that bite are all here: CRLF line endings, folding lines at 75
 * octets (not characters — an emoji or "✓" is several), and escaping , ; \
 * and newlines in text. Timed events are written in UTC, converted from the
 * player's wall-clock time and zone, so no VTIMEZONE block is needed and no
 * client has to know the zone database.
 */

export type IcsEvent = {
  uid: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  summary: string;
  description?: string;
  url?: string;
  /** Absent: an all-day event. Present: starts at `start` local time in `timeZone`. */
  timed?: { start: string; minutes: number; timeZone: string };
};

const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

/** Fold to 75 octets per line, continuation lines starting with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    const limit = out.length ? 74 : 75; // continuation lines spend one on the space
    if (bytes.encode(cur + ch).length > limit) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.map((l, i) => (i ? ' ' + l : l)).join('\r\n');
}

const compactDate = (iso: string) => iso.replace(/-/g, '');
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function nextDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + 1));
  return x.toISOString().slice(0, 10);
}

/** Offset of `timeZone` from UTC at instant `t`, in ms. */
function offsetAt(t: number, timeZone: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
}

/** The instant a wall-clock time happens in a zone. Twice, for DST edges. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let t = wall - offsetAt(wall, timeZone);
  t = wall - offsetAt(t, timeZone);
  return new Date(t);
}

/** Today's date where the player is, YYYY-MM-DD. */
export function todayIn(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function calendar(name: string, events: IcsEvent[], now = new Date()): string {
  const stamp = utcStamp(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Train.futbol//Training calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    // Hints only. Apple and Outlook may honour them; Google refreshes on its
    // own schedule whatever this says.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (e.timed) {
      const start = zonedToUtc(e.date, e.timed.start, e.timed.timeZone);
      const end = new Date(start.getTime() + Math.max(5, e.timed.minutes) * 60000);
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(e.date)}`, `DTEND;VALUE=DATE:${compactDate(nextDay(e.date))}`);
    }
    // A day banner shouldn't make the whole day look busy; a timed session should.
    lines.push(`SUMMARY:${esc(e.summary)}`, `TRANSP:${e.timed ? 'OPAQUE' : 'TRANSPARENT'}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
