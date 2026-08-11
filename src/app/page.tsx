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

      <p className="eyebrow mb-3">Train now</p>
      <h1 className="h-hero max-w-[15ch]">
        What have you<br />got today?
      </h1>
      <p className="mt-3.5 max-w-[34ch] text-[15px] leading-relaxed text-muted">
        Tell me your time and your focus. I&rsquo;ll build the session and count the touches.
      </p>

      <Coach exercises={exercises} />
    </div>
  );
}
