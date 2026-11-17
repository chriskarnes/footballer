/**
 * How a drill reads to a ten-year-old. The library's names and amounts were
 * typed in capitals ("JUGGLING WITH ONE BOUNCE", "50 BOTH FEET") and its
 * amounts as "1 × 250-500". A trainer's own drills are left as written.
 */

const SMALL = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

/** A name typed all in capitals, in title case. Anything else is left alone. */
export function drillName(name: string): string {
  if (!name || name !== name.toUpperCase() || !/[A-Z]{2}/.test(name)) return name;
  return name.toLowerCase().split(' ').map((w, i) => {
    // "(R)", "(L)", "1V1", "2V2": short codes stay in capitals.
    if (/^\(?[a-z]\)?$/.test(w) && w !== 'a') return w.toUpperCase();
    if (/^\(?\d+v\d+\)?$/.test(w)) return w.toUpperCase().replace('V', 'v');
    if (i > 0 && SMALL.has(w)) return w;
    return w.replace(/[a-z]/, (c) => c.toUpperCase());
  }).join(' ');
}

const range = (s: string) => s.replace(/(\d)\s*-\s*(\d)/g, '$1 to $2');

/** "45-60s" → "45 to 60 seconds", "20M" → "20 m", "50 BOTH FEET" → "50 both feet". */
export function plainAmount(raw: string): string { return reps(raw); }
function reps(raw: string): string {
  let s = range(raw.trim());
  if (s === s.toUpperCase()) s = s.toLowerCase();
  s = s.replace(/(\d)\s*s\b/g, '$1 seconds').replace(/(\d)\s*m\b/g, '$1 m').replace(/(\d)\s*ea\b/g, '$1 each');
  return s.replace(/\b1 seconds\b/, '1 second');
}

/** How much of a drill to do: "3 rounds of 30 seconds", "250 to 500 reps", "50 both feet". */
export function amountLabel(sets: string | null | undefined, repsTime: string | null | undefined): string {
  const r = reps(repsTime ?? '');
  const n = (sets ?? '').trim();
  const bare = /^\d+( to \d+)?$/.test(r);
  if (!r) return n && n !== '1' ? `${range(n)} rounds` : '';
  if (!n || n === '1') return bare ? `${r} ${r === '1' ? 'rep' : 'reps'}` : r;
  return `${range(n)} rounds of ${r}`;
}
