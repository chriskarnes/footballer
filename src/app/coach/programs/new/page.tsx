import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { ProgramForm } from '@/components/coach/ProgramForm';

export const metadata = { title: 'New program', robots: { index: false } };

export default async function NewProgramPage() {
  const gate = await staffOnly('/coach/programs/new');
  if ('page' in gate) return gate.page;
  return (
    <div className="animate-pop">
      <BackLink href="/coach/content" label="Programs" />
      <h1 className="h-page">New program</h1>
      <p className="mb-6 mt-2 max-w-[36ch] text-[14px] leading-relaxed text-on-surface-variant">
        Weeks of at-home work. Give it to a group, or to one player.
      </p>
      <ProgramForm />
    </div>
  );
}
