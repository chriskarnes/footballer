'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * A short silent loop with the same two-ink treatment as the photos (see
 * .duotone): it reads as moving print, not a phone video. Fills its parent.
 *
 * Muted, inline and looping so phones can play it unasked. The poster is the
 * first frame, so the page looks the same before it plays. Nothing of the
 * clip is fetched until it is about to play: with reduced motion or data
 * saving asked for, it stays on the poster and the megabyte stays unsent.
 *
 * With `delay` (ms) it sits over a still instead: nothing loads until the
 * visitor has lingered that long, then it fades in once it is actually
 * playing. With reduced motion it never appears, and the still stays.
 */
export function DuotoneVideo({ src, poster, position = '50% 50%', label, delay }: {
  src: string; poster: string; position?: string; label: string; delay?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [shown, setShown] = useState(!delay);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let due = !delay;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const saving = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const apply = () => { if (still.matches || saving || !due) v.pause(); else v.play().catch(() => {}); };
    if (delay) timer = setTimeout(() => { due = true; apply(); }, delay);
    apply();
    still.addEventListener('change', apply);
    return () => { clearTimeout(timer); still.removeEventListener('change', apply); };
  }, [delay]);
  return (
    <div className={`duotone grain absolute inset-0 ${delay ? 'transition-opacity duration-[1500ms] ease-out' : ''}`}
         style={delay ? { opacity: shown ? 1 : 0 } : undefined}>
      <video ref={ref} src={src} poster={delay ? undefined : poster} muted loop playsInline
             preload="none"
             onPlaying={() => setShown(true)}
             aria-label={label} aria-hidden={delay ? !shown : undefined}
             className="h-full w-full object-cover" style={{ objectPosition: position }} />
    </div>
  );
}
