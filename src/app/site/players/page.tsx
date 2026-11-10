import Link from 'next/link';
import { SectionHead, Step } from '@/components/site/SiteChrome';
import { FindTrainer } from '@/components/site/FindTrainer';
import { Lime, SiteHero } from '@/components/site/Photo';

export const metadata = {
  title: 'For players · Train.futbol',
  description: 'Find your trainer, get the sessions they set for you, and train at home.',
};

/**
 * For players and parents. Most arrive with a link from their trainer and never
 * see this; it's for the ones who heard the name and typed it in.
 */
export default function PlayersPage() {
  return (
    <>
      <SiteHero video={{ src: '/site/goal.mp4', poster: '/site/goal-poster.jpg' }}
                alt="A young player cuts past a defender and scores, the cut and shot in slow motion" position="55% 50%"
                cards={[{ kind: 'done', title: 'Both feet', sub: 'Wed · 24 min · U12 Tuesday', at: { top: 40, right: -12 } }]}>
        <span className="marker">For players and parents</span>
        <h1 className="site-wide mt-5 max-w-[12ch] text-[40px] uppercase leading-[.94] text-white sm:text-[64px]">
          Find your <Lime>trainer.</Lime>
        </h1>
        <p className="mt-6 max-w-[32rem] text-[17px] leading-relaxed text-site-mint sm:text-[19px]">
          Every trainer here has their own page. Find yours, ask to join, and your sessions appear as soon as they let you in.
        </p>
        <div className="mt-8 max-w-[34rem]">
          <FindTrainer />
          <p className="mt-5 text-[14.5px] leading-relaxed text-on-surface-variant">
            <b className="text-on-surface">Got a link from your trainer?</b> Just open it. It takes you straight in, no asking needed.
          </p>
        </div>
      </SiteHero>

      <section className="mt-24">
        <SectionHead eyebrow="What you get" title="A plan for the days you're not at practice." />
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="Your week, set by your trainer">
            Open the app and today&rsquo;s session is waiting. No deciding what to do.
          </Step>
          <Step n="2" title="Drills with a timer">
            Each drill has a video, the reps, and a clock. Most sessions take 15 to 30 minutes.
          </Step>
          <Step n="3" title="Your trainer sees it">
            Tick it off and they know. They&rsquo;ll send you a note when you&rsquo;re flying, or when the week slips.
          </Step>
        </ol>
      </section>

      <section className="mt-24 card-flat p-8">
        <h2 className="h-card text-on-surface">Don&rsquo;t have a trainer here yet?</h2>
        <p className="mt-2 max-w-[36rem] text-[15px] leading-relaxed text-on-surface-variant">
          We&rsquo;re just getting started, so there aren&rsquo;t many trainers to browse yet. If you train with someone,
          send them this page. If you are someone&rsquo;s trainer, <Link href="/trainers" className="font-semibold text-on-surface underline underline-offset-4">start here</Link>.
        </p>
      </section>
    </>
  );
}
