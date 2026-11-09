import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { DrillForm } from '@/components/coach/DrillForm';

export const metadata = { title: 'New drill', robots: { index: false } };

export default async function NewDrillPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const gate = await staffOnly('/coach/drills/new');
  if ('page' in gate) return gate.page;
  const { back } = await searchParams;
  const to = back?.startsWith('/coach') ? back : '/coach/drills';
  return (
    <div className="animate-pop">
      <BackLink href={to} label={to === '/coach/drills' ? 'Drills' : 'Back'} />
      <h1 className="h-page mb-6">New drill</h1>
      <DrillForm back={to} />
    </div>
  );
}
