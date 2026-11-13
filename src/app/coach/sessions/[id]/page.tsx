import { notFound } from 'next/navigation';
import { staffOnly } from '@/components/coach/Gate';
import { SessionEditor } from '@/components/coach/SessionEditor';
import { loadContent } from '@/lib/academy-data';
import { placesOf } from '@/lib/session-library';
import { PageHead } from '@/components/coach/PageHead';

export const metadata = { title: 'Session', robots: { index: false } };

/** One library session: its drills, and where it's used. */
export default async function LibrarySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await staffOnly(`/coach/sessions/${id}`);
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  const s = c.library.find((x) => x.id === id);
  if (!s) notFound();
  return (
    <div className="animate-pop">
      <PageHead back={{ href: '/coach/sessions', label: 'Sessions' }} title={s.name} />
      <div className="mt-6" />
      <SessionEditor session={s} drills={c.drills} target={{ kind: 'library', id: s.id, usedIn: placesOf(c, s.id) }} />
    </div>
  );
}
