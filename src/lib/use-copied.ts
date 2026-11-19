import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "Copied", shown for two seconds after a copy. `flash()` starts it; pressing
 * again restarts the two seconds rather than stacking timers, where the first
 * one used to cut the second "Copied" short.
 *
 * The button's own label changing isn't read out, since focus never leaves
 * it. Put `copied ? 'Copied' : ''` in a role="status" element beside the
 * button so a screen reader says it too.
 */
export function useCopied(ms = 2000): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = useCallback(() => {
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), ms);
  }, [ms]);
  return [copied, flash];
}
