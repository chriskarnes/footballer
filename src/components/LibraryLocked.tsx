import Link from 'next/link';
import { Suspense } from 'react';
import { BandTag, BandTitle, BrandBand } from './BrandBand';
import { NoteBanner } from './NoteBanner';
import { TrainerWeek } from './TrainerWeek';
import { getMyWeek, getPlayerState } from '@/lib/player-week';
import { Waiting } from './Waiting';

/**
 * What Train, Library and Plan show in an academy that doesn't have the drill
 * library — every academy but the demo. With a week from their trainer,
 * that's the page; without one, a placeholder. Speed & Stamina is the platform's own and works everywhere, so
 * it's the way forward from here.
 */
export async function LibraryLocked({ title }: { title: string }) {
  // A player with nothing set this week hears from their trainer, not Speed.
  const state = await getPlayerState().catch(() => ({ kind: 'none' }) as const);
  if (state.kind === 'new' || state.kind === 'waiting') return <Waiting state={state} />;
  // What their trainer has set them is the page, when there's anything.
  const week = await getMyWeek().catch(() => null);
  if (week) {
    return (
      <div className="animate-pop">
        <TrainerWeek week={week} />
        <div className="mt-4"><Suspense fallback={null}><NoteBanner /></Suspense></div>
        <Link href="/speed" className="btn-ghost pressable mt-8 min-h-[52px] w-full text-[15px] font-bold">Get faster</Link>
      </div>
    );
  }
  return (
    <div className="animate-pop">
      <BrandBand>
        <BandTag>{title}</BandTag>
        <BandTitle>Nothing yet</BandTitle>
        <p className="mt-3 text-[16px] font-semibold text-on-surface-brand-variant">
          Your trainer hasn&rsquo;t set a session. Try a speed session.
        </p>
      </BrandBand>
      <Suspense fallback={null}><NoteBanner /></Suspense>
      <Link href="/speed" className="btn-primary btn-big pressable mt-6 w-full">Get faster</Link>
    </div>
  );
}
