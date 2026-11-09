import { notFound } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { SessionEditor } from '@/components/coach/SessionEditor';
import { loadContent } from '@/lib/academy-data';

export const metadata = { title: 'Session', robots: { index: false } };

/** ?week=n adds a session to that week; ?id= edits one. */
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
  const here = `/coach/programs/${p.id}/session?${session ? `id=${session.id}` : `week=${week}`}`;

  return (
    <div className="animate-pop">
      <BackLink href={`/coach/programs/${p.id}`} label={p.name} />
      <p className="eyebrow mb-3">Week {week}</p>
      <h1 className="h-page mb-6">{session ? session.name : 'New session'}</h1>
      <SessionEditor programId={p.id} week={week} session={session} drills={c.drills}
                     newDrillHref={`/coach/drills/new?back=${encodeURIComponent(here)}`} />
    </div>
  );
}
