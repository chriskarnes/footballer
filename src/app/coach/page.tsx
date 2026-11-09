import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { staffOnly } from '@/components/coach/Gate';
import { StatusDot, WeekDots } from '@/components/coach/WeekDots';
import { InviteLink } from '@/components/coach/InviteLink';
import { loadPlayers } from '@/lib/coach-data';
import { byAttention, detailOf } from '@/lib/progress';

export const metadata = { title: 'Coach', robots: { index: false } };

/**
 * The trainer's front page: who needs a word from them this week.
 *
 * The headline is the count of players who need a nudge, because that's the
 * question a trainer opens this with. The list is sorted worst first, so the
 * players to act on are at the top and the Nudge button is next to them.
 */
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const gate = await staffOnly('/coach');
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const { sent } = await searchParams;

  const [{ players, error }, { data: invite }] = await Promise.all([
    loadPlayers(db, academy),
    db.from('academy_invites').select('code').eq('academy_id', academy.id).eq('role', 'player').maybeSingle(),
  ]);
  players.sort(byAttention);

  const needs = players.filter((p) => p.progress.status !== 'good').length;
  const trained = players.filter((p) => p.progress.done > 0).length;
  const sessions = players.reduce((a, p) => a + p.progress.done, 0);
  const minutes = players.reduce((a, p) => a + p.progress.minutesThisWeek, 0);

  return (
    <div className="animate-pop">
      <header className="app-bar">
        <Brand small />
        <Link href="/coach/team" className="text-[13px] font-semibold text-on-surface-variant underline underline-offset-4">Team</Link>
      </header>

      <p className="eyebrow mb-3 mt-8">This week</p>
      <h1 className="h-page">
        {!players.length ? 'No players yet'
          : needs ? `${needs} ${needs === 1 ? 'player needs' : 'players need'} a nudge`
          : 'Everyone’s on track'}
      </h1>

      {sent && (
        <p role="status" className="card-flat mt-4 px-4 py-3 text-[13.5px] font-semibold text-on-surface">
          Note sent. Players see it next time they open the app.
        </p>
      )}

      {!!players.length && (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <Stat value={`${trained}/${players.length}`} label="trained" />
            <Stat value={sessions} label={sessions === 1 ? 'session' : 'sessions'} />
            <Stat value={minutes} label="minutes" />
          </div>
          <Link href="/coach/send" className="btn-ghost pressable mt-4 w-full">Send a note to everyone</Link>
        </>
      )}

      {error && <p className="mt-4 text-[13px] text-on-surface-variant">Couldn&rsquo;t load players: {error}</p>}

      <ul className="mt-6 space-y-2.5">
        {players.map((p) => {
          const detail = detailOf(p.progress);
          return (
            <li key={p.user_id} className="card flex items-center gap-3 py-4 pl-4 pr-3">
              <Link href={`/coach/players/${p.user_id}`} className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-on-surface">{p.name}</span>
                <span className="mt-1 flex items-center gap-2 text-[13px] text-on-surface-variant">
                  <StatusDot status={p.progress.status} />
                  <span className="truncate">
                    <span className="font-semibold text-on-surface">{p.progress.reason}</span>
                    {detail && <> · {detail}</>}
                  </span>
                </span>
                <span className="mt-3 block"><WeekDots week={p.progress.week} /></span>
              </Link>
              {p.progress.status !== 'good' && (
                <Link href={`/coach/send?to=${p.user_id}&kind=nudge`} className="btn-ghost btn-sm pressable shrink-0">
                  Nudge
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <section className="mt-9">
        <p className="eyebrow mb-3">Add players</p>
        <div className="card p-5">
          <div className="h-card">Invite link</div>
          <p className="mt-1 text-[13.5px] leading-snug text-on-surface-variant">
            Text it to a player or a parent. They sign in with their email and appear here.
          </p>
          {invite?.code
            ? <InviteLink path={`/join/${invite.code}`} role="player" canRotate={false} />
            : <p className="mt-3 text-[13px]">No invite link yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="card-flat px-3 py-3 text-center">
      <div className="font-brand text-[22px] font-extrabold leading-none text-on-surface">{value}</div>
      <div className="mt-1 text-[11.5px] font-semibold text-on-surface-variant">{label}</div>
    </div>
  );
}
