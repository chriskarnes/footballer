import Link from 'next/link';
import { getViewer } from '@/lib/viewer';
import { loadContent } from '@/lib/academy-data';
import { drillTags } from '@/lib/academy-week';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';
import { BandTag, BandTitle, BrandBand } from './BrandBand';

const label = (t: string) => FOCUS_LABELS[t as FocusArea] ?? t;
const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-on-surface-variant" fill="none"
       stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
);

/**
 * The academy's own programs and drills, for players, when their trainer
 * lets them browse (0015). Any session or drill runs and is recorded like
 * one their trainer set. Null when it's off or there's nothing in it.
 */
export async function AcademyLibrary({ heading = true }: { heading?: boolean }) {
  const v = await getViewer();
  if (!v.academy || !v.user || !v.role) return null;
  const c = await loadContent(v.db, v.academy.id);
  if (!c.defaults.playerLibrary) return null;
  if (!c.programs.length && !c.drills.length) return null;

  const tags = [...new Set(c.drills.flatMap(drillTags))];
  const groups = [
    ...tags.map((t) => ({ key: t, title: label(t), drills: c.drills.filter((d) => drillTags(d)[0] === t) })),
    { key: 'other', title: 'More drills', drills: c.drills.filter((d) => !drillTags(d).length) },
  ].filter((g) => g.drills.length);

  return (
    <div>
      {heading && (
        <BrandBand>
          <BandTag>Library</BandTag>
          <BandTitle>Pick one and go</BandTitle>
        </BrandBand>
      )}

      {!!c.programs.length && (
        <section className="mt-8">
          <h2 className="h-sec mb-3">Programs</h2>
          <div className="stagger space-y-2.5">
            {c.programs.map((p) => {
              const sessions = c.sessions.filter((s) => s.program_id === p.id).sort((a, b) => a.week - b.week || a.position - b.position);
              if (!sessions.length) return null;
              return (
                <details key={p.id} className="card group overflow-hidden">
                  <summary className="pressable flex cursor-pointer list-none items-center gap-4 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-title-sm font-bold leading-snug text-on-surface">{p.name}</span>
                      <span className="mt-0.5 block text-body font-semibold text-on-surface-variant">{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</span>
                    </span>
                    <span className="transition-transform group-open:rotate-90"><Chevron /></span>
                  </summary>
                  <ul className="divide-y divide-outline-variant border-t border-outline-variant">
                    {sessions.map((s) => (
                      <li key={s.id}>
                        <Link href={`/train/session/${s.id}?from=library`} className="flex min-h-14 items-center gap-3 px-4 py-3">
                          <span className="min-w-0 flex-1">
                            <span className="block text-body-lg font-bold text-on-surface">{s.name}</span>
                            <span className="block text-body font-medium text-on-surface-variant">Week {s.week}</span>
                          </span>
                          <Chevron />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.key} className="mt-8">
          <h2 className="h-sec mb-3">{g.title}</h2>
          <ul className="card divide-y divide-outline-variant">
            {g.drills.map((d) => (
              <li key={d.id}>
                <Link href={`/train/drill/${d.id}?from=library`} className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-lg font-bold text-on-surface">{d.name}</span>
                    <span className="block truncate text-body font-medium text-on-surface-variant">{d.amount ?? `${d.minutes} min`}</span>
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
