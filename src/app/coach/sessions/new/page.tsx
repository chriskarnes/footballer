import { redirect } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { SessionEditor } from '@/components/coach/SessionEditor';
import { loadContent } from '@/lib/academy-data';

export const metadata = { title: 'New session', robots: { index: false } };

/** A new session in the library; it goes into a program from that program's week. */
export default async function NewSessionPage() {
  const gate = await staffOnly('/coach/sessions/new');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  if (!c.libraryReady) redirect('/coach/sessions');
  return (
    <div className="animate-pop">
      <BackLink href="/coach/sessions" label="Sessions" />
      <h1 className="h-page mb-6">New session</h1>
      <SessionEditor drills={c.drills} target={{ kind: 'library', usedIn: [] }} />
    </div>
  );
}
