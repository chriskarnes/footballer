import { notFound } from 'next/navigation';
import { staffOnly } from '@/components/coach/Gate';
import { Runner } from '@/components/Runner';
import { loadContent } from '@/lib/academy-data';
import { asExercise } from '@/lib/as-exercise';
import type { Exercise } from '@/lib/types';

export const metadata = { title: 'Preview', robots: { index: false } };

/**
 * A session as a player gets it: the same runner, with the trainer's drills,
 * videos and steps, at a phone's width. Ticks work, so the flow can be felt;
 * Finish saves nothing.
 */
export default async function SessionPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await staffOnly(`/coach/sessions/${id}/preview`);
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  const s = c.library.find((x) => x.id === id);
  if (!s) notFound();
  const byId = new Map(c.drills.map((d) => [d.id, d]));
  const drills = s.drill_ids.map((d, i) => byId.get(d) && asExercise(byId.get(d)!, s.id, i)).filter(Boolean) as Exercise[];
  const back = { href: `/coach/sessions/${s.id}`, label: s.name };
  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-4 rounded-full bg-surface-container-high px-4 py-2 text-center text-body-sm font-semibold text-on-surface-variant">
        Preview: what a player sees. Nothing here is saved.
      </p>
      <Runner title={s.name} drills={drills} back={back} doneHref={back.href} preview />
    </div>
  );
}
