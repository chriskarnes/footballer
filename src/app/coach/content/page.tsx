import Link from 'next/link';
import { staffOnly } from '@/components/coach/Gate';
import { CoachNav } from '@/components/coach/CoachNav';
import { loadContent } from '@/lib/academy-data';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';
import { youtubeId } from '@/lib/video';
import { Pending } from '@/components/coach/Pending';

export const metadata = { title: 'Programs', robots: { index: false } };

/**
 * What the academy teaches: its programs (weeks of at-home sessions), and
 * the drills those sessions are made of.
 */
export default async function ContentPage() {
  const gate = await staffOnly('/coach/content');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);

  return (
    <div className="animate-pop">
      <CoachNav at="/coach/content" />
      {!c.ready && <Pending />}

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="eyebrow">Programs</p>
          <Link href="/coach/programs/new" className="text-[13px] font-semibold text-on-surface underline underline-offset-4">New program</Link>
        </div>
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

      <section className="mt-9">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="eyebrow">Drills · {c.drills.length}</p>
          <Link href="/coach/drills/new" className="text-[13px] font-semibold text-on-surface underline underline-offset-4">New drill</Link>
        </div>
        {c.drills.length ? (
          <ul className="card divide-y divide-outline-variant">
            {c.drills.map((d) => (
              <li key={d.id}>
                <Link href={`/coach/drills/${d.id}`} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold text-on-surface">{d.name}</span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-on-surface-variant">
                      {[d.amount, `${d.minutes} min`, d.focus && (FOCUS_LABELS[d.focus as FocusArea] ?? d.focus)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {d.video_url && <span className="shrink-0 text-[12px] font-semibold text-on-surface-variant">{youtubeId(d.video_url) ? 'Video' : 'Link'}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No drills yet" href="/coach/drills/new" cta="Add a drill">
            Start with the ones you always use. A name and &ldquo;3 × 50 each foot&rdquo; is enough; a YouTube link is a bonus.
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
