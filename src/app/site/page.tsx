import Link from 'next/link';
import { SectionHead, Step } from '@/components/site/SiteChrome';
import { DarkCta, Lime, PhotoBand, SiteHero } from '@/components/site/Photo';
import strike from '@/assets/site/strike.jpg';
import teams from '@/assets/site/teams.jpg';

export const metadata = {
  title: 'Train.futbol: soccer drills to do at home, picked by your trainer',
  description: 'Soccer trainers pick drills for their players to do at home, and see who did them.',
};

/** The front door: two kinds of visitor, so two doors, and nothing else first. */
export default function SiteHome() {
  return (
    <>
      <SiteHero photo={strike}
                video={{ src: '/site/match.mp4', poster: '/site/match-poster.jpg', delay: 5000, position: '70% 50%' }}
                alt="A young player in a training bib strikes a ball on an artificial pitch" position="62% 45%"
                cards={[{ kind: 'done', title: 'Touch and pass', sub: 'Tuesday · 15 min · done', at: { top: 40, right: -12 } }]}>
        <span className="marker">At-home soccer training</span>
        <h1 className="site-wide mt-5 max-w-[13ch] text-[42px] uppercase leading-[.94] text-white sm:text-[68px]">
          Soccer drills to do <Lime>at home.</Lime>
        </h1>
        <p className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-site-mint sm:text-[19px]">
          You pick the drills for the week. Your players do them at home with a ball and a wall.
          You see who did them.
        </p>
      </SiteHero>

      {/* The two doors sit across the fold, half in the dark and half out. */}
      <section className="relative -mt-24 grid gap-4 sm:-mt-28 sm:grid-cols-2">
        <Door href="/trainers" dark eyebrow="I'm a trainer" title="Set drills for your players"
              body="Pick drills for each player to do at home. See who did them, and remind the ones who didn't." cta="How it works" />
        <Door href="/players" eyebrow="I'm a player or parent" title="Find your trainer"
              body="Get the drills your trainer picked for you, and check them off as you finish." cta="Find my trainer" />
      </section>

      <PhotoBand photo={teams} alt="Young players from two teams around a goal during a match" position="45% 55%"
                 eyebrow="For trainers with players from different clubs" title="They play for different clubs. They all do your drills.">
        Your players are on different teams. During the week, each one does the drills you gave them at home.
      </PhotoBand>

      <section className="mt-24">
        <SectionHead eyebrow="How it works" title="Two or three short sessions a week, and you see who did them." />
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="The trainer picks the sessions">
            Two or three short sessions a week on what the player needs, like ball mastery, first touch, or finishing.
          </Step>
          <Step n="2" title="The player trains at home">
            Each session is a list of drills. Every drill has a video and a timer. A session takes 15 to 30 minutes.
          </Step>
          <Step n="3" title="The trainer sees who did it">
            When a player finishes a session, the trainer sees it. If a player falls behind, the trainer can send a reminder in one tap.
          </Step>
        </ol>
      </section>

      <DarkCta title="Set up your first week with us." href="/start" cta="Get started">
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
