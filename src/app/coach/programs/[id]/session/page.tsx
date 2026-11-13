import { notFound } from 'next/navigation';
import { staffOnly } from '@/components/coach/Gate';
import { SessionEditor } from '@/components/coach/SessionEditor';
import { PickSession } from '@/components/coach/PickSession';
import { loadContent } from '@/lib/academy-data';
import { placesOf } from '@/lib/session-library';
import { PageHead } from '@/components/coach/PageHead';

export const metadata = { title: 'Session', robots: { index: false } };

/**
 * ?week=n adds a session to that week: one from the library, or a new one
 * (which joins the library). ?id= edits the one that's there.
 */
export default async function SessionEditPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ week?: string; id?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const gate = await staffOnly(`/coach/programs/${id}`);
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  const p = c.programs.find((x) => x.id === id);
  if (!p) notFound();
  const session = q.id ? c.sessions.find((s) => s.id === q.id && s.program_id === p.id) : undefined;
  if (q.id && !session) notFound();
  const week = session?.week ?? Math.max(1, Math.min(p.weeks, Number(q.week) || 1));
  const minutes = new Map(c.drills.map((d) => [d.id, d.minutes]));

  return (
    <div className="animate-pop">
      <PageHead back={{ href: `/coach/programs/${p.id}`, label: p.name }} eyebrow={`Week ${week}`}
                title={session ? session.name : 'Add a session'} />
      <div className="mt-6" />

      {!session && c.libraryReady && !!c.library.length && (
        <section className="mb-9">
          <p className="eyebrow mb-2">From your sessions</p>
          <PickSession programId={p.id} week={week}
            sessions={c.library.map((s) => ({
              id: s.id, name: s.name, drills: s.drill_ids.length,
              minutes: s.drill_ids.reduce((a, d) => a + (minutes.get(d) ?? 0), 0),
              here: c.sessions.some((x) => x.program_id === p.id && x.week === week && x.library_id === s.id),
            }))} />
          <p className="eyebrow mb-2 mt-9">Or build a new one</p>
        </section>
      )}

      <SessionEditor session={session} drills={c.drills}
        target={c.libraryReady
          ? { kind: 'placed', programId: p.id, week, placementId: session?.id, libraryId: session?.library_id,
              alsoIn: session?.library_id ? placesOf(c, session.library_id, session.id) : [] }
          : { kind: 'legacy', programId: p.id, week, id: session?.id }} />
    </div>
  );
}
