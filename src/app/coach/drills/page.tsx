import Link from 'next/link';
import { staffOnly } from '@/components/coach/Gate';
import { Pending } from '@/components/coach/Pending';
import { PageHead } from '@/components/coach/PageHead';
import { LIBRARY_VIEWS, ViewTabs } from '@/components/coach/ViewTabs';
import { loadContent } from '@/lib/academy-data';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';
import { youtubeId } from '@/lib/video';
import { drillTags, type DrillRow } from '@/lib/academy-week';

export const metadata = { title: 'Drills', robots: { index: false } };

/**
 * The trainer's drills: the pieces their sessions are built from.
 *
 * Typing a drill out is the slowest part of setting up, so the page leads with
 * the ways in. Only "Write it" is live; the other three are where this is
 * going, and are shown as such rather than hidden:
 *   - From the library: white-labelled drills to adopt and rename.
 *   - Say it: dictate, and AI turns it into name, reps and steps.
 *   - From a link: paste a video, and AI drafts the drill from it.
 * Each lands in the same DrillForm, filled in, for the trainer to check.
 */
const WAYS = [
  { key: 'write',   title: 'Write it',          body: 'Name, reps and a few steps. A YouTube link if you have one.', href: '/coach/drills/new' },
  { key: 'library', title: 'From the library',  body: 'Pick from ready-made drills and make them yours.' },
  { key: 'say',     title: 'Say it',            body: 'Talk it through the way you’d explain it. We write it up.' },
  { key: 'link',    title: 'From a link',       body: 'Paste a video of a drill. We draft it for you to check.' },
] as const;

export default async function DrillsPage() {
  const gate = await staffOnly('/coach/drills');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  const used = (id: string) => c.sessions.filter((s) => s.drill_ids?.includes(id)).length;

  return (
    <div className="animate-pop">
      {!c.ready && <Pending />}
      <ViewTabs tabs={LIBRARY_VIEWS} on="/coach/drills" />
      <PageHead title="Drills" eyebrow={`${c.drills.length} ${c.drills.length === 1 ? 'drill' : 'drills'}`}>
        What your sessions are built from. Add the ones you always use first.
      </PageHead>

      <section className="mt-6" aria-label="Add a drill">
        <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {WAYS.map((w) => {
            const live = 'href' in w;
            const inner = (
              <>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14.5px] font-bold text-on-surface">{w.title}</span>
                  {!live && <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">Soon</span>}
                </span>
                <span className="mt-1 block text-[12.5px] leading-snug text-on-surface-variant">{w.body}</span>
              </>
            );
            return (
              <li key={w.key}>
                {live
                  ? <Link href={w.href} className="card pressable block h-full p-4 ring-1 ring-on-surface/80">{inner}</Link>
                  : <div className="card-flat block h-full p-4 opacity-80" aria-disabled="true">{inner}</div>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-9">
        {c.drills.length ? (
          <>
            {/* Phone: a list. */}
            <ul className="card divide-y divide-outline-variant lg:hidden">
              {c.drills.map((d) => (
                <li key={d.id}>
                  <Link href={`/coach/drills/${d.id}`} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold text-on-surface">{d.name}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-on-surface-variant">
                        {[d.amount, `${d.minutes} min`, tagLabels(d)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {d.video_url && <span className="shrink-0 text-[12px] font-semibold text-on-surface-variant">{youtubeId(d.video_url) ? 'Video' : 'Link'}</span>}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Laptop: a table. */}
            <div className="card hidden overflow-hidden lg:block">
              <table className="w-full text-left text-[14px]">
                <thead className="border-b border-outline-variant text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">
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
          <p className="card-flat p-5 text-[13.5px] leading-relaxed text-on-surface-variant">
            No drills yet. A name and &ldquo;3 × 50 each foot&rdquo; is enough to start; a YouTube link is a bonus.
          </p>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-5 py-3 font-semibold">{children}</th>;
}

const tagLabels = (d: DrillRow) => drillTags(d).map((t) => FOCUS_LABELS[t as FocusArea] ?? t).join(', ');
