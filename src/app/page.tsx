import { getExercises } from '@/lib/library';
import { libraryAllowed } from '@/lib/branding-server';
import { LibraryLocked } from '@/components/LibraryLocked';
import { Coach } from '@/components/Coach';
import { Brand } from '@/components/Brand';
import { TodayOnPlan } from '@/components/TodayOnPlan';
import { Suspense } from 'react';
import { NoteBanner } from '@/components/NoteBanner';
import { TrainerWeek } from '@/components/TrainerWeek';
import { getMyWeek } from '@/lib/player-week';

// TRAIN NOW is the front door. No sign-in, no setup, no form.
export default async function TrainNowPage() {
  if (!(await libraryAllowed())) return <LibraryLocked title="Train" />;
  const exercises = await getExercises();
  return (
    <div className="animate-pop">
      {/* Landmarks, not loose divs held apart by a margin. */}
      {/* The trainer's week, when they've set one, leads in the academy's
          colours; otherwise the plain bar. Its own Suspense, so signed-out
          visitors never wait on the lookup. */}
      <Suspense fallback={<Bar />}><MyTrainerWeek /></Suspense>

      {/* A note from the trainer outranks everything else on the page. */}
      <Suspense fallback={null}><NoteBanner /></Suspense>

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

function Bar() {
  return (
    <header className="app-bar">
      <Brand small />
      <span className="text-[12px] font-semibold text-on-surface-variant">786 drills</span>
    </header>
  );
}

async function MyTrainerWeek() {
  const week = await getMyWeek().catch(() => null);
  return week ? <div className="mb-10"><TrainerWeek week={week} /></div> : <Bar />;
}
