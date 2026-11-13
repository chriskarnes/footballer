import { staffOnly } from '@/components/coach/Gate';
import { ProgramForm } from '@/components/coach/ProgramForm';
import { PageHead } from '@/components/coach/PageHead';

export const metadata = { title: 'New program', robots: { index: false } };

export default async function NewProgramPage() {
  const gate = await staffOnly('/coach/programs/new');
  if ('page' in gate) return gate.page;
  return (
    <div className="animate-pop">
      <PageHead back={{ href: '/coach/content', label: 'Programs' }} title="New program">
        Weeks of at-home work. Give it to a group, or to one player.
      </PageHead>
      <div className="mt-6"><ProgramForm /></div>
    </div>
  );
}
