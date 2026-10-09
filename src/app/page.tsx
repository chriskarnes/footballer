import { getExercises } from '@/lib/library';
import { Coach } from '@/components/Coach';
import { Brand } from '@/components/Brand';
import { TodayOnPlan } from '@/components/TodayOnPlan';
import { Suspense } from 'react';

// TRAIN NOW is the front door. No sign-in, no setup, no form.
export default async function TrainNowPage() {
  const exercises = await getExercises();
  return (
    <div className="animate-pop">
      {/* Landmarks, not loose divs held apart by a margin. */}
      <header className="app-bar">
        <Brand small />
        <span className="text-[12px] font-semibold text-on-surface-variant">786 drills</span>
      </header>

      {/* The headline lives in Coach now: it changes with the step, from
          "Start training now" to the session you've just made. */}
      {/* Today's session from the week you follow, if you follow one. Under
          its own Suspense so signed-out visitors — most of them — never wait
          on the account lookup it needs. */}
      <Coach exercises={exercises}
             planCard={<Suspense fallback={null}><TodayOnPlan /></Suspense>} />
    </div>
  );
}
