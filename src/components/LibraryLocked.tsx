import { Suspense } from 'react';
import { BandTag, BandTitle, BrandBand } from './BrandBand';
import { NoteBanner } from './NoteBanner';
import { TrainerWeek } from './TrainerWeek';
import { getMyWeek, getPlayerState, getTrainer } from '@/lib/player-week';
import { speedAllowed } from '@/lib/speed-gate';
import { Waiting } from './Waiting';
import { SpeedInvite } from './SpeedInvite';

/**
 * What Train, Library and Plan show in an academy that doesn't have the drill
 * library — every academy but the demo. With a week from their trainer,
 * that's the page, and its band has the way on once the week is done; without
 * one, a placeholder. Speed & Stamina is the platform's own and works
 * everywhere, so it's the way forward from there, when their trainer offers it.
 */
export async function LibraryLocked({ title }: { title: string }) {
  // A player with nothing set this week hears from their trainer, not Speed.
  const state = await getPlayerState().catch(() => ({ kind: 'none' }) as const);
  if (state.kind === 'new' || state.kind === 'waiting') return <Waiting state={state} />;
  // What their trainer has set them is the page, when there's anything.
  const week = await getMyWeek().catch(() => null);
  if (week) return <div className="animate-pop"><TrainerWeek week={week} /></div>;
  const [speed, trainer] = await Promise.all([speedAllowed().catch(() => true), getTrainer().catch(() => null)]);
  return (
    <div className="animate-pop">
      <BrandBand>
        <BandTag>{title}</BandTag>
        <BandTitle>Nothing yet</BandTitle>
        <p className="mt-3 text-[16px] font-semibold text-on-surface-brand-variant">
          Your trainer hasn&rsquo;t set a session.
        </p>
      </BrandBand>
      <Suspense fallback={null}><NoteBanner /></Suspense>
      {speed && <SpeedInvite trainer={trainer?.name ?? null} className="mt-6" />}
    </div>
  );
}
