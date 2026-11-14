import { notFound } from 'next/navigation';
import { staffOnly } from '@/components/coach/Gate';
import { SessionEditor } from '@/components/coach/SessionEditor';
import { PickSession } from '@/components/coach/PickSession';
import { loadContent } from '@/lib/academy-data';
import { programWeek } from '@/lib/academy-week';
import { localDate } from '@/lib/progress';
import { placesOf } from '@/lib/session-library';
import { PageHead } from '@/components/coach/PageHead';

export const metadata = { title: 'Session', robots: { index: false } };

/**
 * ?week=n adds a session to that week: one from the library, or a new one
 * (which joins the library). ?id= edits the one that's there.
 */
export default async function SessionEditPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ week?: string; id?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  // Signing in comes back to this editor, with its week and session.
  const back = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => typeof e[1] === 'string'));
  const gate = await staffOnly(`/coach/programs/${id}/session${back.size ? `?${back}` : ''}`);
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const c = await loadContent(db, academy.id);
  const p = c.programs.find((x) => x.id === id);
  if (!p) notFound();
  const session = q.id ? c.sessions.find((s) => s.id === q.id && s.program_id === p.id) : undefined;
  if (q.id && !session) notFound();
  const week = session?.week ?? Math.max(1, Math.min(p.weeks, Number(q.week) || 1));
  const minutes = new Map(c.drills.map((d) => [d.id, d.minutes]));

  // Taking out a week's last session doesn't empty the week: it repeats the
  // last earlier one with sessions. Said in the confirm, with who's on it now.
  let lastNote: string | undefined;
  if (session && c.sessions.filter((s) => s.program_id === p.id && s.week === week).length === 1) {
    const earlier = c.sessions.filter((s) => s.program_id === p.id && s.week < week).map((s) => s.week);
    const repeats = earlier.length ? Math.max(...earlier) : null;
    const today = localDate(new Date(), academy.timeZone);
    const { data: members } = await db.from('academy_members').select('user_id').eq('academy_id', academy.id).eq('role', 'player');
    const current = new Set(((members ?? []) as { user_id: string }[]).map((m) => m.user_id));
    const groups = c.groups.filter((g) => !g.archived && g.program_id === p.id && g.starts_on && programWeek(g.starts_on, p.weeks, today) === week).map((g) => g.name);
    const solo = c.playerPrograms.filter((x) => x.program_id === p.id && (!members || current.has(x.user_id)) && programWeek(x.starts_on, p.weeks, today) === week).length;
    const who = [...groups, ...(solo ? [`${solo} ${solo === 1 ? 'player' : 'players'} on their own`] : [])];
    lastNote = `It’s the last session in week ${week}, so week ${week} ${repeats ? `repeats week ${repeats}` : 'is empty'} after this.`
      + (who.length ? ` ${who.join(', ')} ${who.length === 1 && !/players on their own$/.test(who[0]) ? 'is' : 'are'} on week ${week} now; what they’ve done of it this week will show as not done.` : '');
  }

  return (
    <div className="animate-pop">
      <PageHead back={{ href: `/coach/programs/${p.id}`, label: p.name }} eyebrow={`Week ${week}`}
                title={session ? session.name : 'Add a session'} />
      <div className="mt-6" />

      {!session && c.libraryReady && !!c.library.length && (
        <section className="mb-9">
          <p className="eyebrow mb-2">From your sessions</p>
          <PickSession programId={p.id} week={week}
            sessions={c.library.map((s) => ({
              id: s.id, name: s.name, drills: s.drill_ids.length,
              minutes: s.drill_ids.reduce((a, d) => a + (minutes.get(d) ?? 0), 0),
              here: c.sessions.some((x) => x.program_id === p.id && x.week === week && x.library_id === s.id),
            }))} />
          <p className="eyebrow mb-2 mt-9">Or build a new one</p>
        </section>
      )}

      <SessionEditor session={session} drills={c.drills} lastNote={lastNote}
        target={c.libraryReady
          ? { kind: 'placed', programId: p.id, week, placementId: session?.id, libraryId: session?.library_id,
              alsoIn: session?.library_id ? placesOf(c, session.library_id, session.id) : [] }
          : { kind: 'legacy', programId: p.id, week, id: session?.id }} />
    </div>
  );
}
