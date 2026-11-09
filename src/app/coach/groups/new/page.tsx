import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { GroupForm } from '@/components/coach/GroupForm';
import { loadContent } from '@/lib/academy-data';
import { localDate } from '@/lib/progress';

export const metadata = { title: 'New group', robots: { index: false } };

export default async function NewGroupPage() {
  const gate = await staffOnly('/coach/groups/new');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  return (
    <div className="animate-pop">
      <BackLink href="/coach/groups" label="Groups" />
      <h1 className="h-page mb-6">New group</h1>
      <GroupForm programs={c.programs} today={localDate(new Date(), academy.timeZone)} />
    </div>
  );
}
