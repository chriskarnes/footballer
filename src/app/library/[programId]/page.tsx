import { notFound } from 'next/navigation';
import { libraryAllowed } from '@/lib/library-gate';
import { LibraryLocked } from '@/components/LibraryLocked';
import { getPrograms, getSessions } from '@/lib/library';
import { formatTouches } from '@/lib/session-builder';
import { PROGRAM_BLURBS, formatMinutes, splitSessionName } from '@/lib/program-copy';
import { serverClient } from '@/lib/supabase/server';
import { BackLink } from '@/components/BackLink';
import { BlockSection, BlockStrip, SessionList, type Block, type CardSession } from '@/components/ProgramSessions';


/**
 * A program: what it is, how big it is, where you are in it, and its sessions.
 *
 * Session names in the source carry their schedule ("Weeks 1-4 (Day 1) Ball
 * Control + Juggling"), which means "do Days 1–4 every week, for four weeks"
 * — and nothing said so. Programs built that way are drawn as blocks on a
 * timeline, each saying it repeats, with a strip at the top for the shape of
 * the whole thing. Programs without blocks are a numbered list of the same
 * cards.
 *
 * Signed in, finished library sessions from history give each card its
 * progress and pick the one session that is next; that card is the only
 * brand block on the page. Signed out, the first card says "Start here".
 */
export default async function ProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  if (!(await libraryAllowed())) return <LibraryLocked title="Library" next="/library" />;
  const [programs, sessions] = await Promise.all([getPrograms(), getSessions()]);
  const program = programs.find((p) => p.id === programId);
  if (!program) notFound();

  const mine = sessions.filter((s) => s.program_id === program.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const done = await finishedCounts(mine.map((s) => s.id));
  const signedIn = done !== null;

  const cards: (CardSession & { weeks: string | null; weekCount: number })[] = mine.map((s, i) => {
    const { weeks, weekCount, day, title } = splitSessionName(s.name);
    const label = day ? `Day ${day}` : `Session ${i + 1}`;
    return {
      id: s.id, weeks, weekCount, title, label: title === label ? null : label,
      minutes: s.total_minutes, touches: s.touches, focus: s.focus_areas,
      done: done ? done.get(s.id) ?? 0 : null, target: weekCount,
    };
  });

  // Consecutive sessions sharing a "Weeks x–y" are one block.
  const blocks: Block[] = [];
  for (const c of cards) {
    const last = blocks[blocks.length - 1];
    if (c.weeks && last?.weeks === c.weeks) last.sessions.push(c);
    else if (c.weeks) blocks.push({ n: blocks.length + 1, weeks: c.weeks, weekCount: c.weekCount, sessions: [c] });
  }
  const blocked = blocks.length > 1 && cards.every((c) => c.weeks);

  // Next is the first session, in program order, not yet done as often as
  // its block asks. Signed out there is no history, so it is the first one.
  const next = signedIn ? cards.find((c) => (c.done ?? 0) < c.target) ?? null : cards[0] ?? null;
  const featured = signedIn ? 'next' as const : 'start' as const;
  // "You're here" needs history; signed out, no block claims it.
  const currentBlock = signedIn && next ? blocks.find((b) => b.sessions.some((s) => s.id === next.id))?.n ?? 0 : 0;

  const blurb = PROGRAM_BLURBS[program.id];

  return (
    <div className="animate-pop">
      <BackLink href="/library" label="Library" />

      <h1 className="h-page">{program.name}</h1>
      {blurb && (
        <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">{blurb}</p>
      )}

      <dl className="mt-6 flex divide-x divide-outline-variant">
        {blocked
          ? <Stat value={`${blocks.reduce((a, b) => a + b.weekCount, 0)} weeks`} label={`${blocks.length} blocks`} first />
          : <Stat value={String(mine.length)} label="sessions" first />}
        {blocked && <Stat value={`${blocks[0].sessions.length} a week`} label="sessions" />}
        {!blocked && <Stat value={formatMinutes(program.total_minutes)} label="in total" />}
        {!!program.touches && <Stat value={formatTouches(program.touches)} label="touches" />}
      </dl>

      {blocked ? (
        <>
          <BlockStrip blocks={blocks} current={currentBlock} signedIn={signedIn} />
          <div className="mt-10 space-y-12">
            {blocks.map((b, i) => (
              <BlockSection key={b.n} block={b} last={i === blocks.length - 1} current={b.n === currentBlock}
                            nextId={next?.id ?? null} featured={featured} />
            ))}
          </div>
        </>
      ) : (
        <SessionList sessions={cards} nextId={next?.id ?? null} featured={featured} />
      )}
    </div>
  );
}

/**
 * How many times each of these sessions has been finished, or null signed
 * out. A failure of any kind is "signed out": the page is still the program.
 */
async function finishedCounts(ids: string[]): Promise<Map<string, number> | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const db = await serverClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return null;
    const { data } = await db.from('workouts').select('source_ref')
      .eq('user_id', user.id).eq('source', 'library').eq('status', 'completed').in('source_ref', ids);
    const n = new Map<string, number>();
    (data ?? []).forEach((w: { source_ref: string }) => n.set(w.source_ref, (n.get(w.source_ref) ?? 0) + 1));
    return n;
  } catch {
    return null;
  }
}

function Stat({ value, label, first }: { value: string; label: string; first?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col-reverse ${first ? 'pr-4' : 'px-4'}`}>
      <dt className="mt-0.5 text-caption text-on-surface-variant">{label}</dt>
      <dd className="truncate font-brand text-title-lg font-bold tracking-brand-snug text-on-surface">{value}</dd>
    </div>
  );
}
