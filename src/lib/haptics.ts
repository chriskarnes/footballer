/**
 * Haptics.
 *
 * Honest about the platform gap: Android/Chrome supports the Vibration API, iOS
 * Safari does not and never has. There is a well-known hack involving a hidden
 * `<input type="checkbox" switch>` that fires a real haptic on recent iOS — it is
 * undocumented, silently breaks between releases, and is not worth shipping to
 * children's phones. So on iPhone this is a no-op, and the visual press state in
 * `.pressable` carries the feedback instead.
 *
 * Real iOS haptics need the native wrapper. See LAUNCH.md.
 */
export type Haptic = 'tap' | 'select' | 'success';

const PATTERN: Record<Haptic, number | number[]> = {
  tap: 8,               // a chip, a nav item
  select: 14,           // committing to something
  success: [14, 44, 22], // drill ticked off, session finished
};

export function haptic(kind: Haptic = 'tap'): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const v = typeof navigator !== 'undefined' && navigator.vibrate;
  if (typeof v !== 'function') return;
  try {
    navigator.vibrate(PATTERN[kind]);
  } catch {
    /* Some browsers throw when the page isn't visible. Never worth surfacing. */
  }
}
