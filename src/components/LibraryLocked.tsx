import Link from 'next/link';
import { Suspense } from 'react';
import { Brand } from './Brand';
import { NoteBanner } from './NoteBanner';

/**
 * What Train, Library and Plan show in an academy that doesn't have the drill
 * library — every academy but the demo, until trainers can add programs of
 * their own. Speed & Stamina is the platform's own and works everywhere, so
 * it's the way forward from here.
 */
export function LibraryLocked({ title }: { title: string }) {
  return (
    <div className="animate-pop">
      <header className="app-bar"><Brand small /></header>
      <Suspense fallback={null}><NoteBanner /></Suspense>
      <p className="eyebrow mb-3">{title}</p>
      <h1 className="h-page">Your trainer&rsquo;s programs will appear here</h1>
      <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-on-surface-variant">
        In the meantime, Speed &amp; Stamina has a full year of sessions ready to go.
      </p>
      <Link href="/speed" className="btn-primary pressable mt-6 w-full">Open Speed &amp; Stamina</Link>
    </div>
  );
}
