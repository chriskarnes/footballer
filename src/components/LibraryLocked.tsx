import Link from 'next/link';
import { Suspense } from 'react';
import { BandTag, BandTitle, BrandBand } from './BrandBand';
import { NoteBanner } from './NoteBanner';
import { NothingYet, TrainerWeek } from './TrainerWeek';
import { getViewer } from '@/lib/viewer';
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
        <TrainerWeek week={week} />
        <div className="mt-4"><Suspense fallback={null}><NoteBanner /></Suspense></div>
        {/* Something to do when the week is finished; an extra otherwise. */}
        {week.items.length > 0 && (
          <Link href="/speed"
                className={week.items.every((i) => i.done) ? 'btn-primary btn-big pressable mt-6 w-full'
                  : 'btn-ghost pressable mt-6 min-h-[52px] w-full text-[15px] font-bold'}>
            Get faster
          </Link>
        )}
      </div>
    );
  }
  const v = await getViewer().catch(() => null);
  // Signed in with nothing set: they're in, and their trainer is on it.
  if (v?.user) {
    return (
      <div className="animate-pop">
        <NothingYet />
        <div className="mt-4"><Suspense fallback={null}><NoteBanner /></Suspense></div>
      </div>
    );
  }
  return (
    <div className="animate-pop">
      <BrandBand>
        <BandTag>{title}</BandTag>
        <BandTitle>Sign in to train</BandTitle>
      </BrandBand>
      <Link href="/me" className="btn-primary btn-big pressable mt-6 w-full">Sign in</Link>
    </div>
  );
}
