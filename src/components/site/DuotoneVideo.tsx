'use client';
import { useEffect, useRef } from 'react';

/**
 * A short silent loop with the same two-ink treatment as the photos (see
 * .duotone): it reads as moving print, not a phone video. Fills its parent.
 *
 * Muted, inline and looping so phones autoplay it. The poster is the first
 * frame, so the page looks the same before it plays. With reduced motion
 * asked for, it stays on the poster.
 */
export function DuotoneVideo({ src, poster, position = '50% 50%', label }: {
  src: string; poster: string; position?: string; label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => { if (still.matches) v.pause(); else v.play().catch(() => {}); };
    apply();
    still.addEventListener('change', apply);
    return () => still.removeEventListener('change', apply);
  }, []);
  return (
    <div className="duotone grain absolute inset-0">
      <video ref={ref} src={src} poster={poster} muted loop playsInline autoPlay preload="auto"
             aria-label={label} className="h-full w-full object-cover" style={{ objectPosition: position }} />
    </div>
  );
}
