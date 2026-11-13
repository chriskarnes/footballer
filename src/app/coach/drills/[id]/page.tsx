import { notFound } from 'next/navigation';
import { staffOnly } from '@/components/coach/Gate';
import { DrillForm } from '@/components/coach/DrillForm';
import { DrillSessions, type ProgramWeeks } from '@/components/coach/DrillSessions';
import { loadContent } from '@/lib/academy-data';
import type { DrillRow } from '@/lib/academy-week';
import { PageHead } from '@/components/coach/PageHead';

export const metadata = { title: 'Drill', robots: { index: false } };

/**
 * One drill: what it is, and which sessions it's in. Straight after making
 * a drill (?new=1) the sessions come first, as the next step, with Skip.
 */
export default async function DrillPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const fresh = (await searchParams).new === '1';
  const gate = await staffOnly(`/coach/drills/${id}`);
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  const drill = c.drills.find((d) => d.id === id) as DrillRow | undefined;
  if (!drill) notFound();

  // Library sessions first: a change there follows the session into every
  // program week it's in. Then any program session that stands alone (built
  // before the library, or inside a program).
  const library = c.library.map((s) => ({ id: s.id, name: s.name, has: s.drill_ids.includes(drill.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const programs: ProgramWeeks[] = c.programs.map((p) => {
    const mine = c.sessions.filter((s) => s.program_id === p.id && !s.library_id);
    const weeks = [...new Set(mine.map((s) => s.week))].sort((a, b) => a - b);
    return {
      id: p.id, name: p.name,
      weeks: weeks.map((w) => ({
        week: w,
        sessions: mine.filter((s) => s.week === w).sort((a, b) => a.position - b.position)
          .map((s) => ({ id: s.id, name: s.name, has: s.drill_ids.includes(drill.id) })),
      })),
    };
  });
  const sessions = (
    <section className={`card p-5 ${fresh ? '' : 'mt-10'}`}>
      <div className="h-card">{fresh ? 'Add it to sessions?' : 'In sessions'}</div>
      <p className="mb-4 mt-1 text-[14px] leading-snug text-on-surface-variant">
        {fresh ? 'Tick any it belongs in. It goes at the end of each; you can reorder in the session.'
          : 'Tick to add it to a session, untick to take it out.'}
      </p>
      <DrillSessions drillId={drill.id} library={library} programs={programs} fresh={fresh} />
    </section>
  );

  return (
    <div className="animate-pop">
      <PageHead back={{ href: '/coach/drills', label: 'Drills' }} title={drill.name} />
      <div className="mt-6" />
      {fresh && sessions}
      <div className={fresh ? 'mt-10' : ''}>
        {fresh && <p className="eyebrow mb-3">The drill</p>}
        <DrillForm drill={drill} back="/coach/drills"
          others={c.drills.filter((d) => d.id !== drill.id).map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name))} />
      </div>
      {!fresh && sessions}
    </div>
  );
}
