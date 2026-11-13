import Link from 'next/link';
import { staffOnly } from '@/components/coach/Gate';
import { PageHead } from '@/components/coach/PageHead';
import { LIBRARY_VIEWS, ViewTabs } from '@/components/coach/ViewTabs';
import { loadContent } from '@/lib/academy-data';
import { placesOf } from '@/lib/session-library';
import { Empty } from '@/components/coach/Empty';

export const metadata = { title: 'Sessions', robots: { index: false } };

/**
 * The trainer's sessions: drills in an order, built once and used in any
 * week of any program. Between Drills (what a session is made of) and
 * Programs (what sessions make up).
 */
export default async function SessionsPage() {
  const gate = await staffOnly('/coach/sessions');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  const drills = new Map(c.drills.map((d) => [d.id, d]));
  const rows = c.library.map((s) => ({
    ...s,
    minutes: s.drill_ids.reduce((a, d) => a + (drills.get(d)?.minutes ?? 0), 0),
    names: s.drill_ids.map((d) => drills.get(d)?.name).filter(Boolean).join(', '),
    used: placesOf(c, s.id),
  }));

  return (
    <div className="animate-pop">
      <ViewTabs tabs={LIBRARY_VIEWS} on="/coach/sessions" />
      <PageHead title="Sessions"
                action={c.libraryReady && <Link href="/coach/sessions/new" className="btn-primary btn-sm pressable">New session</Link>} />

      <section className="mt-6">
        {!c.libraryReady ? (
          <p className="card-flat px-4 py-3 text-[14px] text-on-surface-variant">
            Sessions on their own aren’t switched on yet. Until then, build them inside a program.
          </p>
        ) : rows.length ? (
          <>
            {/* Phone: a list. */}
            <ul className="card divide-y divide-outline-variant lg:hidden">
              {rows.map((s) => (
                <li key={s.id}>
                  <Link href={`/coach/sessions/${s.id}`} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold text-on-surface">{s.name}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-on-surface-variant">
                        {s.drill_ids.length} {s.drill_ids.length === 1 ? 'drill' : 'drills'} · {s.minutes} min · {s.used.length ? s.used.join(', ') : 'Not used yet'}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-on-surface-variant">›</span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Laptop: a table. */}
            <div className="card hidden overflow-hidden lg:block">
              <table className="w-full table-fixed text-left text-[14px]">
                <colgroup><col className="w-[24%]" /><col /><col className="w-24" /><col className="w-[26%]" /></colgroup>
                <thead className="border-b border-outline-variant text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  <tr><Th>Session</Th><Th>Drills</Th><Th>Time</Th><Th>Used in</Th></tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {rows.map((s) => (
                    <tr key={s.id} className="relative hover:bg-surface-container-low">
                      <td className="truncate px-5 py-3.5 font-semibold text-on-surface">
                        <Link href={`/coach/sessions/${s.id}`} className="after:absolute after:inset-0">{s.name}</Link>
                      </td>
                      <td className="truncate px-5 py-3.5 text-on-surface-variant">{s.names || '—'}</td>
                      <td className="px-5 py-3.5 text-on-surface-variant">{s.minutes} min</td>
                      <td className="truncate px-5 py-3.5 text-on-surface-variant">{s.used.length ? s.used.join(', ') : 'Not used yet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty title="No sessions yet" href="/coach/sessions/new" cta="Build your first session">
            A session is a few drills in order. Build it once here, then add it to any week of any program.
          </Empty>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-5 py-3 font-semibold">{children}</th>;
}
