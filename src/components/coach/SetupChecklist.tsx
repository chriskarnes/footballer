import Link from 'next/link';
import { PageHead } from './PageHead';
import { InviteLink } from './InviteLink';
import { FinishSetup, ListedSwitch, SetupYou } from './Setup';
import { AvatarPicker } from '@/components/AvatarPicker';
import { TickMark } from '@/components/TickMark';
import type { AcademyContent } from '@/lib/academy-data';
import { setupSteps, type Setup } from '@/lib/setup';

/**
 * The setup checklist itself (/coach/setup): five cards, the first one not
 * done open, the done ones showing what they hold with a way to change it.
 */
export function SetupChecklist({ name, email, setup: s, content, profile, invite, players }: {
  name: string; email: string; setup: Setup;
  content: Pick<AcademyContent, 'drills' | 'library' | 'sessions' | 'programs'>;
  profile: { name: string; photoAt: string | null }; invite: string | null; players: number;
}) {
  const drills = content.drills.length;
  const firstSession = content.library[0]?.name ?? content.sessions[0]?.name ?? null;
  const emptyProgram = content.programs.find((p) => !content.sessions.some((x) => x.program_id === p.id)) ?? null;
  const program = content.programs.find((p) => content.sessions.some((x) => x.program_id === p.id)) ?? null;
  const done = setupSteps(s, content);
  const current = done.findIndex((d) => !d);

  const steps: { title: string; why: string; done: string | null; body: React.ReactNode }[] = [
    {
      title: 'You',
      why: 'Your name and photo go next to everything your players see from you.',
      done: s.you ? `${profile.name} · ${s.timeZone.replace(/_/g, ' ')}` : null,
      body: (
        <>
          <div className="mt-4"><AvatarPicker name={profile.name} email={email} updatedAt={profile.photoAt}
                                                    note="Optional. Your players see it next to your name." /></div>
          <SetupYou name={profile.name} timeZone={s.timeZone} fresh={!s.you} />
          <Link href="/coach/brand" className="mt-3 inline-block text-body font-semibold text-on-surface underline underline-offset-4">
            Your academy&rsquo;s colors and logo
          </Link>
        </>
      ),
    },
    {
      title: 'Your drills',
      why: 'Add at least three. A name and how much is enough; a video link helps.',
      done: drills >= 3 ? `${drills} drills` : null,
      body: (
        <>
          <p className="mt-3 text-body font-bold text-on-surface">{drills} of 3</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Link href="/coach/drills/new?back=/coach/setup" className="btn-primary pressable">Add a drill</Link>
            {drills > 0 && <Link href="/coach/drills" className="btn-ghost pressable min-h-[52px]">See your drills</Link>}
          </div>
        </>
      ),
    },
    {
      title: 'A session',
      why: 'Your drills in order. It’s what a player opens and works through at home.',
      done: firstSession,
      body: <Link href="/coach/sessions/new?back=/coach/setup" className="btn-primary pressable mt-4">Build a session</Link>,
    },
    {
      title: 'A program',
      why: 'Name it and put your session in week 1. Until you build week 2, week 1 repeats.',
      done: program?.name ?? null,
      body: emptyProgram
        ? <Link href={`/coach/programs/${emptyProgram.id}`} className="btn-primary pressable mt-4">Put a session in {emptyProgram.name}</Link>
        : <Link href="/coach/programs/new" className="btn-primary pressable mt-4">Make a program</Link>,
    },
    {
      title: 'Your players',
      why: 'Send this link to your players or their parents. They sign in and appear on your Players page. Then put each one in a group with your program, or give them the program, and their week starts.',
      done: s.done ? (s.listed ? 'Finished · in Find your trainer' : 'Finished · invite link only') : null,
      body: (
        <>
          {invite
            ? <InviteLink path={`/join/${invite}`} role="player" canRotate={false} />
            : <p className="mt-3 text-body text-on-surface-variant">No invite link yet.</p>}
          {!!players && <p className="mt-3 text-body font-semibold text-on-surface">{players} {players === 1 ? 'player has' : 'players have'} joined.</p>}
          {s.done
            ? <div className="mt-4"><ListedSwitch initial={s.listed} /></div>
            : <FinishSetup ready={done.slice(0, 4).every(Boolean)} />}
        </>
      ),
    },
  ];

  return (
    <div className="animate-pop">
      <PageHead eyebrow={`${done.filter(Boolean).length} of 5 done`} title={`Set up ${name}`}>
        {s.done
          ? 'All done. Change anything here whenever you like.'
          : 'Five steps to get your first session ready and your players in. Then give them your program from their page or a group.'}
      </PageHead>
      {!s.ready && (
        <p role="status" className="card-flat mt-4 px-4 py-3 text-body font-semibold text-on-surface">
          Your progress here isn’t saved yet. It will be once this is switched on.
        </p>
      )}

      <ol className="mt-6 space-y-3">
        {steps.map((st, i) => {
          const isDone = done[i];
          const open = i === current;
          return (
            <li key={st.title} className="card p-5"
                // .card's shadow would hide a ring; an outline is how the app marks a card.
                style={open ? { outline: '2px solid var(--md-sys-color-on-surface)', outlineOffset: -2 } : undefined}>
              <div className="flex items-start gap-3">
                <span className="-ml-1 -mt-1 shrink-0">
                  {isDone ? <TickMark on /> : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border-[2.5px] border-primary text-title font-extrabold text-primary">{i + 1}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-title font-extrabold leading-snug text-on-surface">{st.title}</h2>
                  <p className="mt-0.5 text-body-lg leading-snug text-on-surface-variant">
                    {isDone && !open ? st.done : st.why}
                  </p>
                </div>
              </div>
              {open && st.body}
              {/* A done step can be opened again to change it. */}
              {isDone && !open && (
                <details className="mt-1 pl-[52px]">
                  <summary className="cursor-pointer text-body font-semibold text-on-surface-variant underline underline-offset-4">Change</summary>
                  <div>{st.body}</div>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
