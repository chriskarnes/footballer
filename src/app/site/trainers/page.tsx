import Link from 'next/link';
import { SectionHead, Step } from '@/components/site/SiteChrome';
import { PriceCalc } from '@/components/site/PriceCalc';
import { DarkCta, Lime, SiteHero } from '@/components/site/Photo';

export const metadata = {
  title: 'For trainers · Train.futbol',
  description: 'Set at-home training for your players, see who did it, and nudge the ones who didn’t. $5 a player a month.',
};

/**
 * For trainers: what it is in their own terms, what it costs, and how to
 * start. Written for independent trainers whose players come from different
 * teams, not for clubs: no "academy", "club", "staff" or "squad". An academy
 * is "your page", its players are "your players".
 */
export default function TrainersPage() {
  return (
    <>
      <SiteHero video={{ src: '/site/session.mp4', poster: '/site/session-poster.jpg' }}
                alt="Young players working through ball drills at an indoor training session" position="50% 65%"
                cards={[{ kind: 'player', title: 'Liam Carter', sub: 'On track · 3 of 5 this week', at: { top: 40, right: -12 } }]}>
        <span className="marker">For private trainers</span>
        <h1 className="site-wide mt-5 max-w-[14ch] text-[38px] uppercase leading-[.94] text-white sm:text-[60px]">
          Your players, training <Lime>between sessions.</Lime>
        </h1>
        <p className="mt-6 max-w-[32rem] text-[17px] leading-relaxed text-site-mint sm:text-[19px]">
          You see them once or twice a week, and they play for different teams the rest of it. The players who get better
          are the ones who touch a ball on the other days. Set them the work, and see who&rsquo;s doing it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/start" className="btn-lime">Get started</Link>
          <a href="#pricing" className="btn-ghost pressable">See pricing</a>
        </div>
      </SiteHero>

      <section className="mt-24">
        <SectionHead eyebrow="How it fits together" title="Your training, on their phones." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Piece title="Your page" tag="Your name on it">
            One home for everyone you train, at its own address: <b className="text-on-surface">yourname.train.futbol</b>.
            Your name and colours on it, not ours, and not a club&rsquo;s.
          </Piece>
          <Piece title="Your players" tag="From any team">
            You send one link. Players (or their parents) open it, sign in with an email, and they&rsquo;re on your list,
            whichever team they play for. No app store, no passwords.
          </Piece>
          <Piece title="Groups and 1-to-1s" tag="However you train">
            Run small groups at a set time, see players one to one, or both. A player can be in more than one group,
            and each still gets a week that feels like their own.
          </Piece>
          <Piece title="Their week" tag="The homework">
            Two or three short sessions a week: drills, reps and a timer. They tick each one off when it&rsquo;s done.
          </Piece>
        </div>
      </section>

      <section className="mt-24">
        <SectionHead eyebrow="Your side" title="Who trained this week, at a glance." />
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="See everyone">
            Each player&rsquo;s week in one line: on track, one behind, or not seen since Tuesday. The ones who need a word are at the top.
          </Step>
          <Step n="2" title="Send a nudge">
            One tap writes it for you (&ldquo;You&rsquo;re one behind this week. Can you fit one in today?&rdquo;). Or a note to a whole group.
          </Step>
          <Step n="3" title="No group chat">
            Notes go one way, trainer to player. Nobody replies, nothing to moderate, and every note is kept.
          </Step>
        </ol>
      </section>

      <section id="pricing" className="mt-24 scroll-mt-8">
        <SectionHead eyebrow="Pricing" title="$5 a player, a month.">
          If you charge your players more than $5 a month through Train.futbol, we add 10% of the difference.
          Or pay the $5 yourself and charge them however you already do.
        </SectionHead>
        <div className="mt-8 max-w-[40rem]">
          <PriceCalc />
          <ul className="mt-5 space-y-2 text-[14.5px] leading-relaxed text-on-surface-variant">
            <li>No setup fee and no contract. Players you remove stop counting the next month.</li>
            <li>Players pay by card. The money goes to your bank account, not through ours.</li>
          </ul>
        </div>
      </section>

      <section className="mt-24">
        <SectionHead eyebrow="Questions" title="Before you ask." />
        <dl className="mt-8 max-w-[44rem] divide-y divide-outline-variant border-y border-outline-variant">
          <Faq q="I only have a handful of drills. Is that enough?">
            Yes. Most trainers start with three or four sessions they already run, and add as they go. We set up your first sessions with you.
          </Faq>
          <Faq q="My drills are already on YouTube.">
            Good. Paste the link and it plays inside the session. If you&rsquo;d rather film new ones, a phone held sideways is plenty.
          </Faq>
          <Faq q="Can I say hello before they start?">
            Make your first session an introduction: a short video of you, what the next few weeks are for, and one easy drill to finish.
          </Faq>
          <Faq q="Who sees what?">
            You, and anyone you add to help run your sessions, see all your players&rsquo; training. Players see only their own, plus the notes you send them. Other trainers see nothing, and neither do your players&rsquo; clubs.
          </Faq>
          <Faq q="Can I just sign up now?">
            We&rsquo;re setting trainers up by hand for now, so every page starts with sessions in it. Tell us how you train and we&rsquo;ll be in touch within a day.
          </Faq>
        </dl>
      </section>

      <DarkCta title="Ready when you are." href="/start" cta="Get started">
        Tell us how you train. We&rsquo;ll set up your page and your first sessions with you, then you send your players the link.
      </DarkCta>
    </>
  );
}

function Piece({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="card-flat p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="h-card text-on-surface">{title}</h3>
        <span className="text-[13px] font-semibold text-on-surface-variant">{tag}</span>
      </div>
      <p className="mt-2 text-[14.5px] leading-relaxed text-on-surface-variant">{children}</p>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="py-5">
      <dt className="text-[16px] font-bold text-on-surface">{q}</dt>
      <dd className="mt-1.5 text-[15px] leading-relaxed text-on-surface-variant">{children}</dd>
    </div>
  );
}
