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
      <Link href="/library"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-muted
                   transition hover:text-body">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        Library
      </Link>

      <p className="eyebrow mb-3">{program.level}</p>
      <h1 className="h-page">{program.name}</h1>
      <p className="mt-3 text-[13px] font-semibold text-goldText">
        {mine.length} sessions · {formatTouches(program.touches)} touches · {program.total_minutes} min
      </p>
      {program.goal && (
        <p className="mt-4 line-clamp-4 text-[14.5px] leading-relaxed text-muted">{program.goal}</p>
      )}

      <div className="stagger mt-8 grid grid-cols-1 gap-2.5">
        {mine.map((s, i) => {
          const drills = exercises.filter((e) => e.session_id === s.id);
          return (
            <Link key={s.id} href={`/session/${s.id}`}
              className="card flex items-center gap-4 p-4 transition active:scale-[.99]">
              <span className="font-display text-[13px] font-bold text-faint">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="h-card truncate">{s.name}</div>
                <div className="mt-1 text-[12.5px] font-medium text-muted">{drills.length} drills</div>
              </div>
              <div className="text-right">
                <div className="font-display text-[15px] font-bold tracking-tighter">
                  {Math.round(s.total_minutes)}m
                </div>
                {!!s.touches && (
                  <div className="mt-0.5 text-[11.5px] font-bold text-goldText">
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
