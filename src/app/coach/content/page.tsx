import Link from 'next/link';
import { staffOnly } from '@/components/coach/Gate';
import { loadContent } from '@/lib/academy-data';
import { Pending } from '@/components/coach/Pending';
import { PageHead } from '@/components/coach/PageHead';
import { LIBRARY_VIEWS, ViewTabs } from '@/components/coach/ViewTabs';

export const metadata = { title: 'Programs', robots: { index: false } };

/**
 * The trainer's programs: runs of weeks of at-home sessions. The drills those
 * sessions are made of have their own page (/coach/drills).
 */
export default async function ContentPage() {
  const gate = await staffOnly('/coach/content');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);

  return (
    <div className="animate-pop">
      {!c.ready && <Pending />}

      <ViewTabs tabs={LIBRARY_VIEWS} on="/coach/content" />
      <PageHead title="Programs" action={<Link href="/coach/programs/new" className="btn-primary btn-sm pressable">New program</Link>}>
        Runs of weeks: what your players do at home between sessions.
      </PageHead>
      <section className="mt-6">
        {c.programs.length ? (
          <ul className="card divide-y divide-outline-variant">
            {c.programs.map((p) => {
              const sessions = c.sessions.filter((s) => s.program_id === p.id);
              const weeks = new Set(sessions.map((s) => s.week)).size;
              const groups = c.groups.filter((g) => g.program_id === p.id && !g.archived).length;
              return (
                <li key={p.id}>
                  <Link href={`/coach/programs/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-4">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold text-on-surface">{p.name}</span>
                      <span className="mt-0.5 block text-[13px] text-on-surface-variant">
                        {p.weeks} weeks · {sessions.length ? `${weeks} ${weeks === 1 ? 'week' : 'weeks'} built` : 'nothing built yet'}
                        {groups ? ` · ${groups} ${groups === 1 ? 'group' : 'groups'}` : ''}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-on-surface-variant">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No programs yet" href="/coach/programs/new" cta="Make your first program">
            A program is a run of weeks: what your players do at home between sessions. Build week 1 and it repeats until you add week 2.
          </Empty>
        )}
      </section>

    </div>
  );
}

function Empty({ title, href, cta, children }: { title: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <div className="card-flat p-5">
      <div className="h-card">{title}</div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-on-surface-variant">{children}</p>
      <Link href={href} className="btn-ghost btn-sm pressable mt-4">{cta}</Link>
    </div>
  );
}
