import Link from 'next/link';
import { AddStarters } from '@/components/coach/ContentButtons';
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
                  <Link href={`/coach/drills/${d.id}`} className="flex items-center gap-3.5 px-4 py-3.5">
                    <Thumb url={d.video_url} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-lg font-semibold text-on-surface">{d.name}</span>
                      <span className="mt-0.5 block truncate text-body-sm text-on-surface-variant">
                        {[d.amount, `${d.minutes} min`, tagLabels(d), used(d.id) ? `in ${used(d.id)} ${used(d.id) === 1 ? 'session' : 'sessions'}` : ''].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Laptop: a table. */}
            <div className="card hidden overflow-hidden lg:block">
              <table className="w-full text-left text-body">
                <thead className="border-b border-outline-variant eyebrow">
                  <tr><Th>Drill</Th><Th>Amount</Th><Th>Time</Th><Th>Focus</Th><Th>In sessions</Th></tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {c.drills.map((d) => {
                    const n = used(d.id);
                    return (
                      <tr key={d.id} className="relative hover:bg-surface-container-low">
                        <td className="px-5 py-3 font-semibold text-on-surface">
                          <span className="flex items-center gap-3.5">
                            <Thumb url={d.video_url} />
                            <Link href={`/coach/drills/${d.id}`} className="after:absolute after:inset-0">{d.name}</Link>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{d.amount || '—'}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{d.minutes} min</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{tagLabels(d) || '—'}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{n || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty title="No drills yet" href="/coach/drills/new" cta="New drill" extra={c.libraryReady && !c.library.length ? <AddStarters /> : undefined}>
            A name and &ldquo;3 × 50 each foot&rdquo; is enough to start; a YouTube link is a bonus.
          </Empty>
        )}
      </section>
    </div>
  );
}

/**
 * The drill's video as a picture: YouTube's own thumbnail, a link mark for a
 * video somewhere else, an empty frame for none. So a list shows at a glance
 * which drills still need filming.
 */
function Thumb({ url }: { url: string | null }) {
  const yt = youtubeId(url);
  const box = 'flex h-10 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-small bg-surface-container-high text-on-surface-variant';
  if (yt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" className={`${box} object-cover`} />
    );
  }
  return (
    <span className={box} title={url ? 'A video link' : 'No video yet'}>
      {url
        ? <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        : <span className="text-caption font-semibold">No video</span>}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-5 py-3 font-semibold">{children}</th>;
}

const tagLabels = (d: DrillRow) => drillTags(d).map((t) => FOCUS_LABELS[t as FocusArea] ?? t).join(', ');
