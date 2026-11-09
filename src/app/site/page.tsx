import Link from 'next/link';
import { SectionHead, Step } from '@/components/site/SiteChrome';
import { DarkCta, Lime, PhotoBand, SiteHero } from '@/components/site/Photo';
import strike from '@/assets/site/strike.jpg';
import teams from '@/assets/site/teams.jpg';

export const metadata = {
  title: 'Train.futbol: at-home training, set by your trainer',
  description: 'Your trainer sets the week. You train at home with a ball. They see it got done.',
};

/** The front door: two kinds of visitor, so two doors, and nothing else first. */
export default function SiteHome() {
  return (
    <>
      <SiteHero photo={strike} alt="A young player in a training bib strikes a ball on an artificial pitch" position="62% 45%"
                cards={[{ kind: 'done', title: 'Touch and pass', sub: 'Tuesday · 15 min · done', at: { top: 40, right: -12 } }]}>
        <span className="marker">At-home training</span>
        <h1 className="site-wide mt-5 max-w-[13ch] text-[42px] uppercase leading-[.94] text-white sm:text-[68px]">
          The training <Lime>between</Lime> training.
        </h1>
        <p className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-site-mint sm:text-[19px]">
          You set the week. Your players do the work at home, with a ball and a bit of wall.
          You see who got it done.
        </p>
      </SiteHero>

      {/* The two doors sit across the fold, half in the dark and half out. */}
      <section className="relative -mt-24 grid gap-4 sm:-mt-28 sm:grid-cols-2">
        <Door href="/trainers" dark eyebrow="I'm a trainer" title="Run your training here"
              body="Set at-home work for every player you train, see who did it, and nudge the ones who didn't." cta="How it works" />
        <Door href="/players" eyebrow="I'm a player or parent" title="Find your trainer"
              body="Get the sessions your trainer has set for you, and tick them off as you go." cta="Find my trainer" />
      </section>

      <PhotoBand photo={teams} alt="Young players from two teams around a goal during a match" position="45% 55%"
                 eyebrow="Trainers who work across clubs" title="Different teams on Saturday. Your homework on Tuesday.">
        Your players wear different shirts at the weekend. Between sessions, they&rsquo;re all working on what you set them.
      </PhotoBand>

      <section className="mt-24">
        <SectionHead eyebrow="How it works" title="One trainer, their players, one week at a time." />
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="The trainer sets the week">
            Two or three short sessions: ball mastery, first touch, finishing. Whatever they&rsquo;re working on together.
          </Step>
          <Step n="2" title="Players train at home">
            Each session is a list of drills with a timer and a video. Fifteen to thirty minutes, most days.
          </Step>
          <Step n="3" title="The trainer sees it">
            Finished sessions show up on the trainer&rsquo;s side. If a player&rsquo;s week slips, they get a nudge.
          </Step>
        </ol>
      </section>

      <DarkCta title="Set next week tonight." href="/start" cta="Get started">
        Tell us how you train. We&rsquo;ll set up your page and your first sessions with you.
        Already training with someone? <Link href="/players" className="font-semibold text-white underline underline-offset-4">Find your trainer</Link>.
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
      <span className={`mt-3 max-w-[30ch] text-[15px] leading-relaxed ${dark ? 'text-site-mint' : 'text-site-ink/80'}`}>{body}</span>
      <span className={`mt-7 inline-flex min-h-[44px] items-center self-start rounded-full border px-5 text-[14px] font-bold transition-colors
        ${dark ? 'border-white/45 text-white group-hover:bg-white/10' : 'border-site-ink/45 text-site-ink group-hover:bg-site-ink/[.06]'}`}>{cta}</span>
    </Link>
  );
}
