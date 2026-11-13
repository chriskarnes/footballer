import { redirect } from 'next/navigation';
import { staffOnly } from '@/components/coach/Gate';
import { SessionEditor } from '@/components/coach/SessionEditor';
import { loadContent } from '@/lib/academy-data';
import { PageHead } from '@/components/coach/PageHead';

export const metadata = { title: 'New session', robots: { index: false } };

/** A new session in the library; it goes into a program from that program's week. */
export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const gate = await staffOnly('/coach/sessions/new');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  if (!c.libraryReady) redirect('/coach/sessions');
  // From the setup checklist: saving goes back to it.
  const setup = (await searchParams).back === '/coach/setup';
  return (
    <div className="animate-pop">
      <PageHead back={setup ? { href: '/coach/setup', label: 'Setup' } : { href: '/coach/sessions', label: 'Sessions' }} title="New session" />
      <div className="mt-6" />
      <SessionEditor drills={c.drills} target={{ kind: 'library', usedIn: [], back: setup ? '/coach/setup' : undefined }} />
    </div>
  );
}
