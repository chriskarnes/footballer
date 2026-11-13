import { staffOnly } from '@/components/coach/Gate';
import { DrillForm } from '@/components/coach/DrillForm';
import { PageHead } from '@/components/coach/PageHead';

export const metadata = { title: 'New drill', robots: { index: false } };

export default async function NewDrillPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const gate = await staffOnly('/coach/drills/new');
  if ('page' in gate) return gate.page;
  const { back } = await searchParams;
  const to = back?.startsWith('/coach') ? back : '/coach/drills';
  return (
    <div className="animate-pop">
      <PageHead back={{ href: to, label: to === '/coach/drills' ? 'Drills' : 'Back' }} title="New drill" />
      <div className="mt-6" />
      <DrillForm back={to} />
    </div>
  );
}
