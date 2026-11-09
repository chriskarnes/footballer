import { notFound } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { DrillForm } from '@/components/coach/DrillForm';
import type { DrillRow } from '@/lib/academy-week';

export const metadata = { title: 'Drill', robots: { index: false } };

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await staffOnly(`/coach/drills/${id}`);
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const { data } = await db.from('drills').select('id, name, amount, minutes, focus, video_url, how')
    .eq('id', id).eq('academy_id', academy.id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="animate-pop">
      <BackLink href="/coach/content" label="Programs" />
      <h1 className="h-page mb-6">{data.name}</h1>
      <DrillForm drill={data as DrillRow} back="/coach/content" />
    </div>
  );
}
