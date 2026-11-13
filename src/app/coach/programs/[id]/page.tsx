import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffOnly } from '@/components/coach/Gate';
import { ProgramForm } from '@/components/coach/ProgramForm';
import { CopyWeek } from '@/components/coach/CopyWeek';
import { loadContent } from '@/lib/academy-data';
import { sessionsForWeek } from '@/lib/academy-week';
import { PageHead } from '@/components/coach/PageHead';
import { inSetup } from '@/lib/setup';

export const metadata = { title: 'Program', robots: { index: false } };

/**
 * A program, week by week. Built weeks list their sessions; an unbuilt week
 * says which week it repeats, so a trainer can see exactly what a player in
 * week 5 gets without building weeks 2 to 5.
 */
export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await staffOnly(`/coach/programs/${id}`);
  if ('page' in gate) return gate.page;
  const { db, academy, role } = gate.viewer;
  // Mid-setup, the program step ends here: the way back is to the checklist.
  const [c, setup, { data: members }] = await Promise.all([
    loadContent(db, academy.id), inSetup(db, academy.id, role),
    db.from('academy_members').select('user_id').eq('academy_id', academy.id).eq('role', 'player'),
  ]);
  const p = c.programs.find((x) => x.id === id);
  if (!p) notFound();

  const drills = new Map(c.drills.map((d) => [d.id, d]));
  const groups = c.groups.filter((g) => g.program_id === p.id && !g.archived);
  // Current players only: someone removed from the academy no longer has it.
  const current = new Set(((members ?? []) as { user_id: string }[]).map((m) => m.user_id));
  const players = c.playerPrograms.filter((x) => x.program_id === p.id && (!members || current.has(x.user_id))).length;
  const built = new Set(c.sessions.filter((s) => s.program_id === p.id).map((s) => s.week));

  return (
    <div className="animate-pop">
      <PageHead back={setup ? { href: '/coach/setup', label: 'Setup' } : { href: '/coach/content', label: 'Programs' }} eyebrow={`${p.weeks} ${p.weeks === 1 ? 'week' : 'weeks'}`} title={p.name}>
        {p.description}
      </PageHead>
      <p className="mt-3 text-body text-on-surface-variant">
        {groups.length || players
          ? <>Used by {[...groups.map((g) => g.name), players ? `${players} ${players === 1 ? 'player' : 'players'} on their own` : ''].filter(Boolean).join(', ')}</>
          : 'Not given to anyone yet. Add it to a group, or to a player from their page.'}
      </p>

      <ol className="mt-7 space-y-3">
        {Array.from({ length: p.weeks }, (_, i) => i + 1).map((n) => {
          const own = built.has(n);
          const shown = sessionsForWeek(c.sessions, p.id, n);
          const repeats = !own && shown.length ? shown[0].week : null;
          return (
            <li key={n} id={`week-${n}`} className={own ? 'card p-5' : 'card-flat p-5'}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="h-card">Week {n}</div>
                <span className="text-body-sm text-on-surface-variant">
                  {own ? `${shown.length} ${shown.length === 1 ? 'session' : 'sessions'}` : repeats ? `Repeats week ${repeats}` : 'Nothing yet'}
                </span>
              </div>
              {own && (
                <ul className="mt-3 divide-y divide-outline-variant border-t border-outline-variant">
                  {shown.map((s) => {
                    const mins = s.drill_ids.reduce((a, d) => a + (drills.get(d)?.minutes ?? 0), 0);
                    return (
                      <li key={s.id}>
                        <Link href={`/coach/programs/${p.id}/session?id=${s.id}`} className="flex items-center justify-between gap-3 py-3">
                          <span className="min-w-0">
                            <span className="block truncate text-body-lg font-semibold text-on-surface">{s.name}</span>
                            <span className="block truncate text-body-sm text-on-surface-variant">
                              {s.drill_ids.map((d) => drills.get(d)?.name).filter(Boolean).join(', ')}
                            </span>
                          </span>
                          <span className="shrink-0 text-body-sm text-on-surface-variant">{mins} min</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {repeats
                  ? <CopyWeek programId={p.id} from={repeats} to={n} label={`Change week ${n}`} />
                  : <Link href={`/coach/programs/${p.id}/session?week=${n}`} className="btn-ghost btn-sm pressable">
                      {own ? 'Add a session' : 'Build this week'}
                    </Link>}
                {own && n < p.weeks && !built.has(n + 1) && <CopyWeek programId={p.id} from={n} to={n + 1} />}
              </div>
            </li>
          );
        })}
      </ol>

      <details className="mt-9">
        <summary className="cursor-pointer text-body font-semibold text-on-surface">Name, length and description</summary>
        <div className="mt-5"><ProgramForm program={p} solo={players} /></div>
      </details>
    </div>
  );
}
