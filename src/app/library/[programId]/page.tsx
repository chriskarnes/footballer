import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getExercises, getPrograms, getSessions } from '@/lib/library';
import { formatTouches } from '@/lib/session-builder';
import { PROGRAM_BLURBS, SHOWN_LEVELS, formatMinutes, splitSessionName } from '@/lib/program-copy';
import { BackLink } from '@/components/BackLink';

const KID: Record<string, string> = {
  'Technical': 'Ball Skills', 'Physical': 'Speed & Strength',
  'Finishing & Crossing': 'Scoring Goals',
};

/**
 * A program: what it is, how big it is, and its sessions in order.
 *
 * The header is three things — the name, one line on what it does, and its
 * size as three numbers — where it had been a level that was usually just
 * "General", a coloured run-on stat line and four lines of PDF text.
 *
 * Session names in the source carry their schedule ("Weeks 1-4 (Day 1) Ball
 * Control + Juggling"). The schedule is lifted out: the weeks become a
 * heading over the sessions they cover, the day a small label, and the card
 * is titled with what the session is.
 */
export default async function ProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const [programs, sessions, exercises] = await Promise.all([
    getPrograms(), getSessions(), getExercises(),
  ]);
  const program = programs.find((p) => p.id === programId);
  if (!program) notFound();

  const mine = sessions.filter((s) => s.program_id === program.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  // Consecutive sessions that share a "Weeks x–y" go under one heading.
  const groups: { weeks: string | null; items: { s: typeof mine[number]; i: number }[] }[] = [];
  mine.forEach((s, i) => {
    const { weeks } = splitSessionName(s.name);
    const last = groups[groups.length - 1];
    if (last && last.weeks === weeks) last.items.push({ s, i });
    else groups.push({ weeks, items: [{ s, i }] });
  });

  const blurb = PROGRAM_BLURBS[program.id];
  const level = SHOWN_LEVELS.includes(program.level) ? program.level : null;

  return (
    <div className="animate-pop">
      <BackLink href="/library" label="Library" />

      <p className="eyebrow mb-3">{KID[program.category] ?? program.category}{level && ` · ${level}`}</p>
      <h1 className="h-page">{program.name}</h1>
      {blurb && (
        <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-on-surface-variant">{blurb}</p>
      )}

      <dl className="mt-6 flex divide-x divide-outline-variant">
        <Stat value={String(mine.length)} label="sessions" first />
        <Stat value={formatMinutes(program.total_minutes)} label="in total" />
        {!!program.touches && <Stat value={formatTouches(program.touches)} label="touches" />}
      </dl>

      <div className="mt-10 space-y-9">
        {groups.map((g, gi) => (
          <section key={gi}>
            {g.weeks && <h2 className="eyebrow mb-3">{g.weeks}</h2>}
            <ol className="stagger space-y-3">
              {g.items.map(({ s, i }) => {
                const { day, title } = splitSessionName(s.name);
                const label = day ? `Day ${day}` : `Session ${i + 1}`;
                const drills = exercises.filter((e) => e.session_id === s.id).length;
                const meta = [
                  formatMinutes(s.total_minutes),
                  `${drills} drill${drills === 1 ? '' : 's'}`,
                  s.touches ? `${formatTouches(s.touches)} touches` : null,
                ].filter(Boolean).join(' · ');
                return (
                  <li key={s.id}>
                    <Link href={`/session/${s.id}`} className="card pressable flex items-center gap-4 px-5 py-5">
                      <div className="min-w-0 flex-1">
                        {title !== label && (
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
                        )}
                        <h3 className="h-card mt-1 leading-snug">{title}</h3>
                        <p className="mt-2 text-[13px] text-on-surface-variant">{meta}</p>
                      </div>
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-on-surface-variant"
                           fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label, first }: { value: string; label: string; first?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col-reverse ${first ? 'pr-4' : 'px-4'}`}>
      <dt className="mt-0.5 text-[12px] text-on-surface-variant">{label}</dt>
      <dd className="truncate font-brand text-[19px] font-bold tracking-tighter text-on-surface">{value}</dd>
    </div>
  );
}
