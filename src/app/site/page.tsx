import Link from 'next/link';
import { SectionHead, Step } from '@/components/site/SiteChrome';
import { PhotoBand, PhotoHero } from '@/components/site/Photo';
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
      <PhotoHero photo={strike} alt="A young player in a training bib strikes a ball on an artificial pitch" position="62% 45%">
        <h1 className="max-w-[16ch] font-brand text-[44px] font-extrabold leading-[1.02] tracking-tightest text-on-surface sm:text-[64px]">
          The training between training.
        </h1>
        <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-on-surface-variant sm:text-[19px]">
          You set the week. Your players do the work at home, with a ball and a bit of wall.
          You see who got it done.
        </p>
      </PhotoHero>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Door href="/trainers" eyebrow="I'm a trainer" title="Run your training here"
              body="Set at-home work for every player you train, see who did it, and nudge the ones who didn't." cta="How it works" />
        <Door href="/players" eyebrow="I'm a player or parent" title="Find your trainer"
              body="Get the sessions your trainer has set for you, and tick them off as you go." cta="Find my trainer" />
      </section>

      <PhotoBand photo={teams} alt="Young players from two teams around a goal during a match" position="45% 55%"
                 eyebrow="For trainers who work across clubs" title="Different teams on Saturday. Your homework on Tuesday.">
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
    </>
  );
}

function Door({ href, eyebrow, title, body, cta }: { href: string; eyebrow: string; title: string; body: string; cta: string }) {
  return (
    <Link href={href} className="card pressable flex flex-col p-6 sm:p-8">
      <span className="eyebrow">{eyebrow}</span>
      <span className="mt-3 font-brand text-[26px] font-extrabold leading-tight tracking-tighter text-on-surface">{title}</span>
      <span className="mt-2 max-w-[30ch] text-[15px] leading-relaxed text-on-surface-variant">{body}</span>
      <span className="mt-6 text-[14px] font-bold text-on-surface">{cta} &rarr;</span>
    </Link>
  );
}
