import { staffOnly } from '@/components/coach/Gate';
import { GroupForm } from '@/components/coach/GroupForm';
import { loadContent } from '@/lib/academy-data';
import { localDate } from '@/lib/progress';
import { PageHead } from '@/components/coach/PageHead';

export const metadata = { title: 'New group', robots: { index: false } };

export default async function NewGroupPage() {
  const gate = await staffOnly('/coach/groups/new');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  return (
    <div className="animate-pop">
      <PageHead back={{ href: '/coach/groups', label: 'Groups' }} title="New group" />
      <div className="mt-6" />
      <GroupForm programs={c.programs} today={localDate(new Date(), academy.timeZone)} />
    </div>
  );
}
