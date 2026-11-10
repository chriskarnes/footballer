import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { StatusDot, WeekDots } from '@/components/coach/WeekDots';
import { RemovePlayer } from '@/components/coach/RemovePlayer';
import { loadPlayers } from '@/lib/coach-data';
import { addDays, localDate, mondayOf, sinceLabel } from '@/lib/progress';
import { loadContent, targetFor } from '@/lib/academy-data';
import { PlayerPlan } from '@/components/coach/PlayerPlan';
import { Extras, ProgramSetup, WeekList } from '@/components/coach/PlayerTraining';
import { SoccerDays } from '@/components/SoccerDays';
import { soccerLabel } from '@/lib/soccer-days';

export const metadata = { title: 'Player', robots: { index: false } };

// The bands the profile form offers (ProfileSetup).
const AGE: Record<string, string> = { u10: 'Under 10', '10_12': 'Age 10–12', '13_15': 'Age 13–15', '16_18': 'Age 16–18', '18_plus': '18+' };

/**
 * One player, for the trainer: this week day by day, the last four weeks,
 * what they actually did, and every note they've been sent — with whether
 * they've read it.
 */
export default async function PlayerPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }>;
}) {
  const { id } = await params;
  const gate = await staffOnly(`/coach/players/${id}`);
  if ('page' in gate) return gate.page;
  const { db, academy } = gate.viewer;
  const { sent } = await searchParams;

  const content = await loadContent(db, academy.id);
  const [{ players }, { data: notes }, { data: runsRaw }] = await Promise.all([
    loadPlayers(db, academy, { player: id, days: 120, content }),
    db.from('note_recipients')
      .select('seen_at, notes!inner(id, body, kind, author_name, created_at, academy_id)')
      .eq('user_id', id).eq('notes.academy_id', academy.id),
    // This fortnight's finished trainer sessions, with how they felt.
    db.rpc('academy_completions', { p_academy: academy.id, p_since: new Date(Date.now() - 15 * 86400000).toISOString() }),
  ]);
  const runs: Record<string, { feel: 'easy' | 'right' | 'hard' | null }> = {};
  for (const r of ((runsRaw ?? []) as { user_id: string; source: string; source_ref: string | null; feel?: 'easy' | 'right' | 'hard' | null }[]))
    if (r.user_id === id && r.source === 'academy' && r.source_ref) runs[r.source_ref] = { feel: r.feel ?? runs[r.source_ref]?.feel ?? null };
  const p = players[0];
  if (!p) notFound();
  const pr = p.progress;
  const soccer = content.schedules.find((x) => x.user_id === p.user_id);
  const tz = academy.timeZone;
  const max = Math.max(1, ...pr.weeks.map((w) => Math.max(w.done, w.planned)));
  const sentNotes = ((notes ?? []) as unknown as { seen_at: string | null; notes: { id: string; body: string; kind: string; author_name: string; created_at: string } }[])
    .sort((a, b) => b.notes.created_at.localeCompare(a.notes.created_at));
  const about = [p.positions?.join(', '), p.age_band && (AGE[p.age_band] ?? p.age_band)].filter(Boolean).join(' · ');

  return (
    <div className="animate-pop lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-x-10">
     <div className="min-w-0">
      <BackLink href="/coach" label="Players" />
      {about && <p className="eyebrow mb-3">{about}</p>}
      <h1 className="h-page">{p.name}</h1>
      <p className="mt-2 flex items-center gap-2 text-[14px] text-on-surface-variant">
        <StatusDot status={pr.status} />
        <span><b className="font-semibold text-on-surface">{pr.reason}</b> · last trained {sinceLabel(pr.daysSince)}</span>
      </p>

      {sent && (
        <p role="status" className="card-flat mt-4 px-4 py-3 text-[13.5px] font-semibold text-on-surface">
          Sent. {p.first} sees it next time they open the app.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Link href={`/coach/send?to=${p.user_id}&kind=nudge`} className="btn-primary pressable">Nudge</Link>
        <Link href={`/coach/send?to=${p.user_id}`} className="btn-ghost pressable">Write a note</Link>
      </div>

      {content.ready && (() => {
        const t = targetFor(content, p.user_id);
        const thisMonday = mondayOf(localDate(new Date(), tz));
        const weeks = { this: thisMonday, next: addDays(thisMonday, 7) };
        // The trainer's sessions; the player's own extras are listed under Extras.
        const mine = content.custom.filter((x) => x.user_id === p.user_id && x.made_by !== 'player');
        const added = content.custom.filter((x) => x.user_id === p.user_id && x.made_by === 'player' && x.week_of === weeks.this)
          .map((x) => ({ id: x.id, name: x.name, done: !!runs[x.id], weekday: x.weekday }));
        const thisWeek = mine.filter((x) => x.week_of === weeks.this);
        const nextWeek = mine.filter((x) => x.week_of === weeks.next);
        // Never chosen (before 0014, or never touched): custom if they have a custom week.
        const mode = t.mode ?? (thisWeek.length || nextWeek.length ? 'custom' : 'program');
        return (
          <>
            <section className="mt-8">
              <p className="eyebrow mb-3">Their week</p>
              <PlayerPlan userId={p.user_id} first={p.first} mode={mode}
                program={
                  <div className="space-y-6">
                    <WeekList first={p.first} week={p.week} />
                    <div className="card p-5">
                      <ProgramSetup userId={p.user_id} first={p.first}
                        groups={content.groups.filter((g) => !g.archived).map((g) => ({ id: g.id, name: g.name,
                          member: content.memberships.some((m) => m.group_id === g.id && m.user_id === p.user_id) }))}
                        programs={content.programs}
                        own={content.playerPrograms.filter((x) => x.user_id === p.user_id).map((x) => ({
                          ...x, label: content.programs.find((pr) => pr.id === x.program_id)?.name ?? 'Program' }))} />
                    </div>
                  </div>
                }
                target={t} defaults={content.defaults} own={t.own} focus={t.focus} progress={t.progress} ownProgress={t.ownProgress}
                drills={content.drills} weeks={weeks} thisWeek={thisWeek} nextWeek={nextWeek} runs={runs}
                busy={{ club: soccer?.club_days ?? [], game: soccer?.game_day ?? null,
                  meets: content.groups.filter((g) => !g.archived && g.meets_weekday !== null
                    && content.memberships.some((m) => m.group_id === g.id && m.user_id === p.user_id)).map((g) => g.meets_weekday as number) }} />
            </section>
            <div className="mt-8">
              <Extras userId={p.user_id} first={p.first} drills={content.drills} added={added}
                addons={content.addons.filter((a) => a.user_id === p.user_id && a.week_of === thisMonday).map((a) => ({
                  id: a.id, note: a.note, name: content.drills.find((d) => d.id === a.drill_id)?.name ?? 'Drill' }))} />
            </div>
          </>
        );
      })()}

      <div className="hidden lg:block"><RemovePlayer userId={p.user_id} name={p.first} /></div>
     </div>

     {/* On a laptop, how they're doing sits beside what they're set. */}
     <aside className="min-w-0 lg:pt-[68px]">
      <section className="card mt-9 p-5 lg:mt-0">
        <div className="flex items-baseline justify-between">
          <div className="h-card">This week</div>
          <div className="text-[13px] text-on-surface-variant">
            {pr.hasPlan ? `${pr.done} of ${pr.planned}` : pr.done} · {pr.minutesThisWeek} min
          </div>
        </div>
        <div className="mt-4"><WeekDots week={pr.week} large /></div>
      </section>

      <section className="card mt-3 p-5">
        <div className="h-card">Their soccer</div>
        <p className="mt-1 text-[13px] leading-snug text-on-surface-variant">
          {soccer ? soccerLabel(soccer.club_days, soccer.game_day) ?? 'No club days.' : `${p.first} hasn’t said yet.`} Sessions go on the other days.
          Set it here if a parent tells you at practice.
        </p>
        <div className="mt-4">
          <SoccerDays club={soccer?.club_days ?? []} game={soccer?.game_day ?? null} userId={p.user_id} />
        </div>
      </section>

      <section className="card mt-3 p-5">
        <div className="flex items-baseline justify-between">
          <div className="h-card">Last four weeks</div>
          <div className="text-[13px] text-on-surface-variant">{pr.streak} {pr.streak === 1 ? 'week' : 'weeks'} in a row</div>
        </div>
        <div className="mt-4 flex h-28 gap-3" role="img"
             aria-label={pr.weeks.map((w) => `${w.done} sessions`).join(', ')}>
          {pr.weeks.map((w, i) => (
            <div key={w.monday} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[12px] font-bold text-on-surface">{w.done}</span>
              <div className="relative w-full flex-1">
                <div className={`absolute inset-x-1 bottom-0 rounded-md ${i === 3 ? 'bg-on-surface' : 'bg-surface-container-highest'}`}
                     style={{ height: `${Math.max(4, (w.done / max) * 100)}%` }} />
              </div>
              <span className="text-[11px] text-on-surface-variant">{i === 3 ? 'This week' : i === 2 ? 'Last week' : `${3 - i} wks ago`}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-9">
        <p className="eyebrow mb-3">Recent sessions</p>
        {p.done.length ? (
          <ul className="card divide-y divide-outline-variant">
            {p.done.slice(0, 8).map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-on-surface">{d.title}</span>
                  <span className="text-[12px] text-on-surface-variant">{dayLabel(d.at, tz)}</span>
                </span>
                <span className="shrink-0 text-[13px] text-on-surface-variant">{Math.round(Number(d.minutes) || 0)} min</span>
              </li>
            ))}
          </ul>
        ) : <p className="pl-1 text-[13.5px] text-on-surface-variant">Nothing finished yet.</p>}
      </section>

      <section className="mt-9">
        <p className="eyebrow mb-3">Notes sent</p>
        {sentNotes.length ? (
          <ul className="space-y-2.5">
            {sentNotes.map(({ seen_at, notes: n }) => (
              <li key={n.id} className="card p-4">
                <p className="whitespace-pre-line text-[14px] leading-snug text-on-surface">{n.body}</p>
                <p className="mt-2 text-[12px] text-on-surface-variant">
                  {n.author_name} · {dayLabel(n.created_at, tz)} · <b className="text-on-surface">{seen_at ? 'Seen' : 'Not seen yet'}</b>
                </p>
              </li>
            ))}
          </ul>
        ) : <p className="pl-1 text-[13.5px] text-on-surface-variant">No notes yet.</p>}
      </section>

      <div className="lg:hidden"><RemovePlayer userId={p.user_id} name={p.first} /></div>
     </aside>
    </div>
  );
}

function dayLabel(at: string, tz: string) {
  const d = localDate(at, tz), today = localDate(new Date(), tz);
  const days = Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(at));
}
