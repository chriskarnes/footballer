import { getExercises } from '@/lib/library';
import { libraryAllowed } from '@/lib/library-gate';
import { LibraryLocked } from '@/components/LibraryLocked';
import { Coach } from '@/components/Coach';
import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import { TodayOnPlan } from '@/components/TodayOnPlan';
import { Suspense } from 'react';
import { NoteBanner } from '@/components/NoteBanner';
import { TrainerWeek } from '@/components/TrainerWeek';
import { getMyWeek, getPlayerState } from '@/lib/player-week';
import { Waiting } from '@/components/Waiting';

// TRAIN NOW is the front door. No sign-in, no setup, no form.
export default async function TrainNowPage() {
  if (!(await libraryAllowed())) return <LibraryLocked title="Train" />;
  // A player waiting on their trainer gets that, not the builder. Anyone
  // else (signed out, staff) is through this with no lookup.
  const state = await getPlayerState().catch(() => ({ kind: 'none' }) as const);
  if (state.kind === 'new' || state.kind === 'waiting') return <Waiting state={state} />;
  const exercises = await getExercises();
  return (
    <div className="animate-pop">
      {/* Landmarks, not loose divs held apart by a margin. */}
      {/* The trainer's week, when they've set one, leads in the academy's
          colours; otherwise the plain bar. Its own Suspense, so signed-out
          visitors never wait on the lookup. */}
      {/* With a week, its band carries the trainer's note; without, the note
          banner does. */}
      <Suspense fallback={<Bar />}><MyTrainerWeek /></Suspense>

      {/* The headline lives in Coach now: it changes with the step, from
          "Start training now" to the session you've just made. */}
      {/* Today's session from your active week, if there is one. Under
          its own Suspense so signed-out visitors — most of them — never wait
          on the account lookup it needs. */}
      <Coach exercises={exercises}
             planCard={<Suspense key="today-on-plan" fallback={null}><TodayOnPlan /></Suspense>} />
    </div>
  );
}

/** Train without a week from their trainer: the band, in the academy's colours. */
function Bar() {
  return (
    <BrandBand>
      <BandTag>Train</BandTag>
      <BandTitle>Let&rsquo;s train</BandTitle>
    </BrandBand>
  );
}

async function MyTrainerWeek() {
  const week = await getMyWeek().catch(() => null);
  return week
    ? <div className="mb-10"><TrainerWeek week={week} /></div>
    : <><Bar /><Suspense fallback={null}><NoteBanner /></Suspense></>;
}
