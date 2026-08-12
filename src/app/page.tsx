import { getExercises } from '@/lib/library';
import { Coach } from '@/components/Coach';
import { Brand } from '@/components/Brand';

// TRAIN NOW is the front door. No sign-in, no setup, no form.
export default async function TrainNowPage() {
  const exercises = await getExercises();
  return (
    <div className="animate-pop">
      <div className="mb-9 flex items-center justify-between">
        <Brand small />
        <span className="text-[12px] font-semibold text-faint">786 drills</span>
      </div>

      {/* No "Train now" kicker above this one: the headline already says it, and
          the tab you arrived on is called Train. Two of the three were noise. */}
      {/* Explicit break, as the previous headline had: left to wrap on its own this
          strands "now" alone on line two. Breaking after "training" is where you'd
          draw breath saying it. */}
      <h1 className="h-hero max-w-[15ch]">
        Start training<br />right now
      </h1>
      <p className="mt-3.5 max-w-[36ch] text-[15px] leading-relaxed text-muted">
        Tell me what you want to work on and how much time you have and I&rsquo;ll build a
        session instantly.
      </p>

      <Coach exercises={exercises} />
    </div>
  );
}
