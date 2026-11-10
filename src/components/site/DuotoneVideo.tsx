'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * A short silent loop with the same two-ink treatment as the photos (see
 * .duotone): it reads as moving print, not a phone video. Fills its parent.
 *
 * Muted, inline and looping so phones autoplay it. The poster is the first
 * frame, so the page looks the same before it plays. With reduced motion
 * asked for, it stays on the poster.
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
    const apply = () => { if (still.matches || !due) v.pause(); else v.play().catch(() => {}); };
    if (delay) timer = setTimeout(() => { due = true; apply(); }, delay);
    apply();
    still.addEventListener('change', apply);
    return () => { clearTimeout(timer); still.removeEventListener('change', apply); };
  }, [delay]);
  return (
    <div className={`duotone grain absolute inset-0 ${delay ? 'transition-opacity duration-[1500ms] ease-out' : ''}`}
         style={delay ? { opacity: shown ? 1 : 0 } : undefined}>
      <video ref={ref} src={src} poster={delay ? undefined : poster} muted loop playsInline
             autoPlay={!delay} preload={delay ? 'none' : 'auto'}
             onPlaying={() => setShown(true)}
             aria-label={label} aria-hidden={delay ? !shown : undefined}
             className="h-full w-full object-cover" style={{ objectPosition: position }} />
    </div>
  );
}
