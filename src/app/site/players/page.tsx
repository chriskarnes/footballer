import Link from 'next/link';
import { SectionHead, Step } from '@/components/site/SiteChrome';
import { FindTrainer } from '@/components/site/FindTrainer';
import { Lime, SiteHero } from '@/components/site/Photo';

export const metadata = {
  title: 'For players · Train.futbol',
  description: 'Find your private soccer trainer and get the drills they picked for you to do at home between sessions.',
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
          Train.futbol is where your private trainer gives you drills to do at home between sessions.
          Find their page and ask to join. Once they accept, your sessions show up.
        </p>
        <div className="mt-8 max-w-[34rem]">
          <FindTrainer />
          <p className="mt-5 text-[14.5px] leading-relaxed text-on-surface-variant">
            <b className="text-on-surface">Got a link from your trainer?</b> Open it. You&rsquo;ll go straight in without asking to join.
          </p>
        </div>
      </SiteHero>

      <section className="mt-24">
        <SectionHead eyebrow="What you get" title="Your trainer's drills, for the days between sessions." />
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="Your trainer picks your week">
            After your session, your trainer picks drills for the days ahead. Open the app and today&rsquo;s session is ready.
          </Step>
          <Step n="2" title="Watch it, then do it">
            Watch how each drill goes, right in the app, and see how many reps to do. Most sessions take 15 to 30 minutes.
          </Step>
          <Step n="3" title="Your trainer sees it">
            Check off a session when you finish, and your trainer knows. They can send you a note during the week. Next session, you start from what you practiced.
          </Step>
        </ol>
      </section>

      <section className="mt-24 card-flat p-8">
        <h2 className="h-card text-on-surface">Don&rsquo;t have a trainer here yet?</h2>
        <p className="mt-2 max-w-[36rem] text-[15px] leading-relaxed text-on-surface-variant">
          We&rsquo;re new, so there aren&rsquo;t many trainers here yet. If you work with a private trainer,
          send them this page. If you&rsquo;re a trainer, <Link href="/trainers" className="font-semibold text-on-surface underline underline-offset-4">start here</Link>.
        </p>
      </section>
    </>
  );
}
