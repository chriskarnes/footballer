import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import { Runner } from '@/components/Runner';
import { SignIn } from '@/components/SignIn';
import { academyOrigin } from '@/lib/tenant';
import { getViewer } from '@/lib/viewer';
import type { DrillRow } from '@/lib/academy-week';
import type { Exercise } from '@/lib/types';
import { asExercise } from '@/lib/as-exercise';
import { getMyWeek, getTrainer } from '@/lib/player-week';

export const metadata = { title: 'Session', robots: { index: false } };

/** A trainer's drill, in the shape the runner draws. */
/**
 * Runs a session from the trainer's week: /train/session/<id> for a program
 * session, /train/custom/<id> for one from a week built for them, /train/addon/<id> for a "just for you" drill. RLS decides what
 * this player may read; finishing records it so their trainer sees it.
 *
 * Done already this week, it opens as done, from the same week Train reads,
 * so the two can't disagree. The drills are the trainer's, so a player sees
 * the trainer's name and face at the top, with their note on the session; a
 * trainer previewing sees neither.
 */
export default async function TrainerSessionPage({ params, searchParams }: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { kind, id } = await params;
  // "Do it again" from your history: back to the history, and run as new
  // rather than opening as this week's finished one.
  const { from } = await searchParams;
  const history = from === 'history';
  const v = await getViewer();
  if (!v.academy || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  // Signed out here, though maybe signed in on the home-screen app: a link
  // from the calendar or a text opens in the browser, which has its own
  // sign-in. "This isn't here any more" would be wrong; it's there once
  // they're signed in.
  if (!v.user) {
    const path = `/train/${kind}/${id}${history ? '?from=history' : from === 'library' ? '?from=library' : ''}`;
    return (
      <div className="animate-pop">
        <BrandBand overlap>
          <BandTag>Your session</BandTag>
          <BandTitle>Sign in to see this session</BandTitle>
          <p className="mt-4 text-title-sm leading-relaxed text-on-surface-brand-variant">
            {/* The self-serve space has no trainer to say it's from. */}
            {v.academy.selfServe
              ? <>It&rsquo;s saved to your account. Sign in with the email you train with and it opens.</>
              : <>It&rsquo;s from your trainer. Sign in with the email you train with and it opens.</>}
          </p>
        </BrandBand>
        <div className="relative -mt-12">
          <SignIn next={path} />
        </div>
      </div>
    );
  }
  const back = history ? { href: '/me', label: 'Your training' }
    : from === 'library' ? { href: '/library', label: 'Library' }
    : { href: '/', label: 'Train' };
  const player = v.role === 'player';
  // The self-serve space has no trainer: getTrainer() still answers (nameless
  // and faceless), and the runner would say "Your trainer will see this".
  const [week, trainer] = player
    ? await Promise.all([getMyWeek().catch(() => null), v.academy.selfServe ? undefined : getTrainer()])
    : [null, undefined];
  const item = week?.items.find((i) => i.kind === kind && i.ref === id);
  const completedDay = item?.done && !history ? item.doneOn ?? item.weekday : null;
  // What the trainer said about this session, said once at the top of it.
  // Who's signed in goes with it: a finish kept on the phone (no signal, or
  // the sign-in lapsed) is theirs even when the phone's own session is gone.
  const mine = { trainer, completedDay, note: item?.note ?? null, owner: v.user.id };

  // Not in this academy. A player in two academies sees both in their
  // history, and "Do it again" lands here on whichever address they're on:
  // if it's the other academy's, say so and send them there, not a 404.
  // RLS lets a member read their academy's content, and any academy's slug.
  const elsewhere = async (table: 'academy_sessions' | 'player_week_sessions' | 'drills' | 'addons') => {
    const { data: row } = await v.db.from(table).select('academy_id').eq('id', id).maybeSingle();
    const other = (row as { academy_id: string } | null)?.academy_id;
    if (!other || other === v.academy!.id) notFound();
    const { data: a } = await v.db.from('academies').select('slug, name').eq('id', other).maybeSingle();
    if (!a) notFound();
    const h = await headers();
    const here = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
    const href = `${academyOrigin(a.slug, here)}/train/${kind}/${id}${history ? '?from=history' : ''}`;
    return (
      <div className="animate-pop pt-10">
        <p className="eyebrow mb-3">{a.name}</p>
        <h1 className="h-page">This session is from another academy&rsquo;s page</h1>
        <p className="mt-2 text-body-lg leading-relaxed text-on-surface-variant">
          It&rsquo;s from {a.name}. Open it on their page and it runs there.
        </p>
        <a href={href} className="btn-primary pressable mt-6 w-full">Open on {a.name}&rsquo;s page</a>
        <Link href={back.href} className="btn-ghost pressable mt-2.5 w-full">Back to {back.label}</Link>
      </div>
    );
  };

  if (kind === 'session') {
    const { data: s } = await v.db.from('academy_sessions').select('id, name, drill_ids').eq('id', id).eq('academy_id', v.academy.id).maybeSingle();
    if (!s) return elsewhere('academy_sessions');
    const { data: rows } = await v.db.from('drills').select('id, name, amount, minutes, focus, video_url, how').in('id', s.drill_ids);
    const byId = new Map(((rows ?? []) as DrillRow[]).map((d) => [d.id, d]));
    const drills = (s.drill_ids as string[]).map((d, i) => byId.get(d) && asExercise(byId.get(d)!, s.id, i)).filter(Boolean) as Exercise[];
    return <Runner title={s.name} drills={drills} sessionRef={s.id} source="academy" back={back} {...mine} />;
  }

  // A session from a week built for this player: runs and records as an
  // academy session, so the trainer's ticks work the same.
  if (kind === 'custom') {
    type Built = { id: string; name: string; drill_ids: string[]; steps?: number[] };
    const q = async (cols: string) => (await v.db.from('player_week_sessions').select(cols).eq('id', id).eq('academy_id', v.academy!.id).maybeSingle()).data as Built | null;
    // With each drill's step (0012), so the amounts are this week's.
    const s = (await q('id, name, drill_ids, steps')) ?? (await q('id, name, drill_ids'));
    if (!s) return elsewhere('player_week_sessions');
    const { data: rows } = await v.db.from('drills').select('id, name, amount, minutes, focus, video_url, how').in('id', s.drill_ids);
    const byId = new Map(((rows ?? []) as DrillRow[]).map((d) => [d.id, d]));
    const steps: number[] = s.steps ?? [];
    const drills = (s.drill_ids as string[]).map((d, i) => byId.get(d) && asExercise(byId.get(d)!, s.id, i, steps[i] ?? 0)).filter(Boolean) as Exercise[];
    return <Runner title={s.name} drills={drills} sessionRef={s.id} source="academy" back={back} {...mine} />;
  }

  // Any drill from the academy's library, when players may browse it.
  if (kind === 'drill') {
    const { data: d } = await v.db.from('drills').select('id, name, amount, minutes, focus, video_url, how').eq('id', id).eq('academy_id', v.academy.id).maybeSingle();
    if (!d) return elsewhere('drills');
    return <Runner title={d.name} drills={[asExercise(d as DrillRow, d.id, 0)]}
                   sessionRef={d.id} source="academy" back={history ? back : { href: '/library', label: 'Library' }} trainer={trainer} owner={v.user.id} />;
  }

  if (kind === 'addon') {
    const { data: a } = await v.db.from('addons').select('id, note, drills(id, name, amount, minutes, focus, video_url, how)')
      .eq('id', id).eq('user_id', v.user.id).eq('academy_id', v.academy.id).maybeSingle();
    // Set by another academy's trainer (a player in two): run it on theirs,
    // so the finish names the trainer who set it.
    if (!a) return elsewhere('addons');
    const d = a.drills as unknown as DrillRow | null;
    if (!d) notFound();
    return <Runner title={d.name} drills={[asExercise(d, a.id, 0)]}
                   sessionRef={a.id} source="addon" back={back} {...mine} note={a.note} />;
  }
  notFound();
}
