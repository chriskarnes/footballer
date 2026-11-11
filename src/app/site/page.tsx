import Link from 'next/link';
import { SectionHead, Step } from '@/components/site/SiteChrome';
import { DarkCta, Lime, PhotoBand, SiteHero } from '@/components/site/Photo';
import strike from '@/assets/site/strike.jpg';
import teams from '@/assets/site/teams.jpg';

export const metadata = {
  title: 'Train.futbol: keep your players training between sessions',
  description: 'For private soccer trainers. Give your players drills to do at home between sessions, and see who did them.',
};

/**
 * The front door. Written to the private trainer who sees a player about once
 * a week: this is how they stay with that player on the other six days. The
 * player's door is the second thing on the page.
 */
export default function SiteHome() {
  return (
    <>
      <SiteHero photo={strike}
                video={{ src: '/site/match.mp4', poster: '/site/match-poster.jpg', delay: 5000, position: '70% 50%' }}
                alt="A young player in a training bib strikes a ball on an artificial pitch" position="62% 45%"
                cards={[{ kind: 'done', title: 'Touch and pass', sub: 'Tuesday · 15 min · done', at: { top: 40, right: -12 } }]}>
        <span className="marker">For private soccer trainers</span>
        <h1 className="site-wide mt-5 max-w-[15ch] text-[40px] uppercase leading-[.94] text-white sm:text-[64px]">
          One session a week. <Lime>Training all week.</Lime>
        </h1>
        <p className="mt-6 max-w-[31rem] text-[17px] leading-relaxed text-site-mint sm:text-[19px]">
          Most players see their private trainer once a week. Train.futbol is for the other six days.
          You pick drills for your players to do at home, and you see who did them.
        </p>
      </SiteHero>

      {/* The two doors sit across the fold, half in the dark and half out. */}
      <section className="relative -mt-24 grid gap-4 sm:-mt-28 sm:grid-cols-2">
        <Door href="/trainers" dark eyebrow="I'm a trainer" title="Train them all week"
              body="Give them drills to do at home between sessions, and see who did them." cta="How it works" />
        <Door href="/players" eyebrow="I'm a player or parent" title="Find your trainer"
              body="Get the drills your trainer picked for you, and do them before your next session." cta="Find my trainer" />
      </section>

      <PhotoBand photo={teams} alt="Young players from two teams around a goal during a match" position="45% 55%"
                 eyebrow="Between sessions" title="Players improve on the days you don&rsquo;t see them.">
        In an hour with you, a player learns what to work on. The touches at home are what make it stick.
        Your drills keep them on the right things until you see them again.
      </PhotoBand>

      <section className="mt-24">
        <SectionHead eyebrow="What it does" title="Make one session go further." />
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          <Point title="More time on the ball">
            Two or three sessions at home add 30 to 90 minutes on the ball a week.
          </Point>
          <Point title="Sessions that build">
            Players practice what you showed them last week. When you see them next, you move on to the next thing.
          </Point>
          <Point title="Their trainer all week">
            Your drills, your videos and your notes are on their phone every day, on a page with your name on it.
          </Point>
        </ul>
      </section>

      <section className="mt-24">
        <SectionHead eyebrow="How it works" title="How a week goes." />
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="You pick the drills">
            After your session, pick two or three short sessions for the week, like ball mastery or first touch.
          </Step>
          <Step n="2" title="Your player trains at home">
            Each session is a list of drills. Every drill has a video and a timer. A session takes 15 to 30 minutes.
          </Step>
          <Step n="3" title="You see who did it">
            When a player finishes a session, you see it. If a player falls behind, you can send a reminder in one tap.
          </Step>
        </ol>
      </section>

      <DarkCta title="Set up your first week." href="/start" cta="Get started">
        Tell us how you train. We&rsquo;ll build your page and your first sessions with you.
        Player or parent? <Link href="/players" className="font-semibold text-white underline underline-offset-4">Find your trainer</Link>.
      </DarkCta>
    </>
  );
}

function Door({ href, eyebrow, title, body, cta, dark }: { href: string; eyebrow: string; title: string; body: string; cta: string; dark?: boolean }) {
  return (
    <Link href={href} className={`pressable group relative flex flex-col overflow-hidden rounded-[26px] p-7 sm:p-9
      shadow-[0_8px_24px_-16px_rgba(7,29,23,.3)] ${dark ? 'bg-site-pitch text-white ring-1 ring-white/10' : 'bg-site-lime text-site-ink'}`}>
      <span className={`text-[11.5px] font-extrabold uppercase tracking-[.16em] ${dark ? 'text-site-lime' : 'text-site-ink/70'}`}>{eyebrow}</span>
      <span className="site-wide mt-3 text-[26px] uppercase leading-[1] sm:text-[30px]">{title}</span>
      <span className={`mt-3 text-[15px] leading-relaxed ${dark ? 'text-site-mint' : 'text-site-ink/80'}`}>{body}</span>
      <span className={`mt-7 inline-flex min-h-[44px] items-center self-start rounded-full border px-5 text-[14px] font-bold transition-colors
        ${dark ? 'border-white/45 text-white group-hover:bg-white/10' : 'border-site-ink text-site-ink group-hover:bg-site-ink/[.08]'}`}>{cta}</span>
    </Link>
  );
}

/** One thing the trainer gets out of it: a plain card, no number. */
function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="card-flat p-6">
      <h3 className="h-card text-on-surface">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-on-surface-variant">{children}</p>
    </li>
  );
}
