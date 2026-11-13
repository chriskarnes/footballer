import Link from 'next/link';
import { staffOnly } from '@/components/coach/Gate';
import { Pending } from '@/components/coach/Pending';
import { PageHead } from '@/components/coach/PageHead';
import { LIBRARY_VIEWS, ViewTabs } from '@/components/coach/ViewTabs';
import { loadContent } from '@/lib/academy-data';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';
import { youtubeId } from '@/lib/video';
import { drillTags, type DrillRow } from '@/lib/academy-week';
import { Empty } from '@/components/coach/Empty';

export const metadata = { title: 'Drills', robots: { index: false } };

/**
 * The trainer's drills: the pieces their sessions are built from.
 */
export default async function DrillsPage() {
  const gate = await staffOnly('/coach/drills');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  // Sessions as the trainer knows them, the way the drill's own page lists
  // them: each library session once (however many weeks it's placed in),
  // plus program sessions that stand on their own.
  const used = (id: string) => c.library.filter((s) => s.drill_ids.includes(id)).length
    + c.sessions.filter((s) => !s.library_id && s.drill_ids?.includes(id)).length;

  return (
    <div className="animate-pop">
      {!c.ready && <Pending />}
      <ViewTabs tabs={LIBRARY_VIEWS} on="/coach/drills" />
      <PageHead title="Drills"
                action={<Link href="/coach/drills/new" className="btn-primary btn-sm pressable">New drill</Link>} />

      <section className="mt-6">
        {c.drills.length ? (
          <>
            {/* Phone: a list. */}
            <ul className="card divide-y divide-outline-variant lg:hidden">
              {c.drills.map((d) => (
                <li key={d.id}>
                  <Link href={`/coach/drills/${d.id}`} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <span className="min-w-0">
                      <span className="block truncate text-body-lg font-semibold text-on-surface">{d.name}</span>
                      <span className="mt-0.5 block truncate text-body-sm text-on-surface-variant">
                        {[d.amount, `${d.minutes} min`, tagLabels(d)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {d.video_url && <span className="shrink-0 text-caption font-semibold text-on-surface-variant">{youtubeId(d.video_url) ? 'Video' : 'Link'}</span>}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Laptop: a table. */}
            <div className="card hidden overflow-hidden lg:block">
              <table className="w-full text-left text-body">
                <thead className="border-b border-outline-variant eyebrow">
                  <tr><Th>Drill</Th><Th>Amount</Th><Th>Time</Th><Th>Focus</Th><Th>Video</Th><Th>In sessions</Th></tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {c.drills.map((d) => {
                    const n = used(d.id);
                    return (
                      <tr key={d.id} className="relative hover:bg-surface-container-low">
                        <td className="px-5 py-3.5 font-semibold text-on-surface">
                          <Link href={`/coach/drills/${d.id}`} className="after:absolute after:inset-0">{d.name}</Link>
                        </td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{d.amount || '—'}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{d.minutes} min</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{tagLabels(d) || '—'}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{d.video_url ? (youtubeId(d.video_url) ? 'YouTube' : 'Link') : '—'}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{n || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty title="No drills yet" href="/coach/drills/new" cta="Add your first drill">
            A name and &ldquo;3 × 50 each foot&rdquo; is enough to start; a YouTube link is a bonus.
          </Empty>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-5 py-3 font-semibold">{children}</th>;
}

const tagLabels = (d: DrillRow) => drillTags(d).map((t) => FOCUS_LABELS[t as FocusArea] ?? t).join(', ');
