import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getExercises, getPrograms, getSessions } from '@/lib/library';
import { formatTouches } from '@/lib/session-builder';

export default async function ProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const [programs, sessions, exercises] = await Promise.all([
    getPrograms(), getSessions(), getExercises(),
  ]);
  const program = programs.find((p) => p.id === programId);
  if (!program) notFound();

  const mine = sessions.filter((s) => s.program_id === program.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="animate-pop">
      {/* This is the whole reason a program can be a page rather than a sheet, so
          it is a real control: 44px of tappable height, its own outline, at the
          top-left where a back affordance is looked for. The previous version was
          13px of text with a 14px chevron — findable, but not reliably hittable. */}
      <Link href="/library" aria-label="Back to Library"
        className="pressable mb-6 inline-flex min-h-11 items-center gap-1.5 rounded-full
                   border border-outline pl-3 pr-4 text-[13px] font-bold text-on-surface-variant
                   hover:text-on-surface">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Library
      </Link>

      <p className="eyebrow mb-3">{program.level}</p>
      <h1 className="h-page">{program.name}</h1>
      <p className="mt-3 text-[13px] font-semibold text-primary">
        {mine.length} sessions · {formatTouches(program.touches)} touches · {program.total_minutes} min
      </p>
      {program.goal && (
        <p className="mt-4 line-clamp-4 text-[14.5px] leading-relaxed text-on-surface-variant">{program.goal}</p>
      )}

      <div className="stagger mt-8 grid grid-cols-1 gap-2.5">
        {mine.map((s, i) => {
          const drills = exercises.filter((e) => e.session_id === s.id);
          return (
            <Link key={s.id} href={`/session/${s.id}`}
              className="card flex items-center gap-4 p-4 transition active:scale-[.99]">
              <span className="font-brand text-[13px] font-bold text-on-surface-variant">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="h-card truncate">{s.name}</div>
                <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">{drills.length} drills</div>
              </div>
              <div className="text-right">
                <div className="font-brand text-[15px] font-bold tracking-tighter">
                  {Math.round(s.total_minutes)}m
                </div>
                {!!s.touches && (
                  <div className="mt-0.5 text-[11.5px] font-bold text-primary">
                    {formatTouches(s.touches)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
