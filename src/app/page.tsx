import { getExercises } from '@/lib/library';
import { Coach } from '@/components/Coach';
import { Brand } from '@/components/Brand';

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

      {/* No "Train now" kicker: the headline says it and the tab you arrived on
          is called Train. The 15ch measure is gone with the explicit break —
          "Start training now" is three words and sets on one line at every
          width we support, so the manual break was breaking a line that no
          longer needed breaking. */}
      <section className="hero">
        <h1 className="h-hero">Start training now</h1>
      </section>

      {/* The promise used to live here, above everything, so the page offered
          one thing and then presented two. It has moved into the coach panel,
          which is the only mode it describes. */}
      <Coach exercises={exercises} />
    </div>
  );
}
