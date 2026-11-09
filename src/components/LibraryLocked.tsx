import Link from 'next/link';
import { Suspense } from 'react';
import { Brand } from './Brand';
import { NoteBanner } from './NoteBanner';
import { TrainerWeek } from './TrainerWeek';
import { getMyWeek } from '@/lib/player-week';

/**
 * What Train, Library and Plan show in an academy that doesn't have the drill
 * library — every academy but the demo. With a week from their trainer,
 * that's the page; without one, a placeholder. Speed & Stamina is the platform's own and works everywhere, so
 * it's the way forward from here.
 */
export async function LibraryLocked({ title }: { title: string }) {
  // What their trainer has set them is the page, when there's anything.
  const week = await getMyWeek().catch(() => null);
  if (week) {
    return (
      <div className="animate-pop">
        <header className="app-bar"><Brand small /></header>
        <Suspense fallback={null}><NoteBanner /></Suspense>
        <TrainerWeek week={week} />
        <Link href="/speed" className="btn-ghost pressable mt-8 w-full">Extra: Speed &amp; Stamina</Link>
      </div>
    );
  }
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
