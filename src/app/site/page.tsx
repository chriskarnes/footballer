import Link from 'next/link';
import { SectionHead, Step } from '@/components/site/SiteChrome';

export const metadata = {
  title: 'Train.futbol: at-home training, set by your coach',
  description: 'Your coach sets the week. You train at home with a ball. They see it got done.',
};

/** The front door: two kinds of visitor, so two doors, and nothing else first. */
export default function SiteHome() {
  return (
    <>
      <section className="pt-14 sm:pt-20">
        <h1 className="max-w-[16ch] font-brand text-[44px] font-extrabold leading-[1.02] tracking-tightest text-on-surface sm:text-[64px]">
          The training between training.
        </h1>
        <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-on-surface-variant sm:text-[19px]">
          Your coach sets the week. You do the work at home, with a ball and a bit of wall.
          They can see it got done.
        </p>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Door href="/players" eyebrow="I'm a player" title="Find your trainer"
              body="Get the sessions your coach has set for you, and tick them off as you go." cta="Find my trainer" />
        <Door href="/coaches" eyebrow="I'm a coach" title="Run your academy here"
              body="Set homework for your whole squad, see who did it, and nudge the ones who didn't." cta="How it works" />
      </section>

      <section className="mt-24">
        <SectionHead eyebrow="How it works" title="One coach, one squad, one week at a time." />
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="Your coach sets the week">
            Two or three short sessions: ball mastery, first touch, finishing. Whatever you&rsquo;re working on together.
          </Step>
          <Step n="2" title="You train at home">
            Each session is a list of drills with a timer and a video. Fifteen to thirty minutes, most days.
          </Step>
          <Step n="3" title="Your coach sees it">
            Finished sessions show up on their side. If the week slips, you&rsquo;ll get a nudge.
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
