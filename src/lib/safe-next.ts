/**
 * A path on this site to go to after signing in, or `fallback`.
 *
 * `/x` only: not `//evil.com`, `/\evil.com`, and nothing with a control
 * character or space in it — browsers drop tabs and newlines from a URL, so
 * `/<tab>/evil.com` would become `//evil.com` and leave the site.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || next.length > 500) return fallback;
  if (!/^\/(?![/\\])/.test(next) || next.includes('\\') || /[\u0000- \u007f]/.test(next)) return fallback;
  return next;
}
