import Link from 'next/link';
import { SectionHead, Step } from '@/components/site/SiteChrome';
import { PriceCalc } from '@/components/site/PriceCalc';
import { DarkCta, Lime, SiteHero } from '@/components/site/Photo';

export const metadata = {
  title: 'For trainers · Train.futbol',
  description: 'For private soccer trainers. Give your players drills to do at home between sessions, see who did them, and stay in touch all week. $5 a player a month.',
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
                alt="Young players working through ball drills at an indoor training session" position="50% 90%"
                cards={[{ kind: 'player', title: 'Liam Carter', sub: 'On track · 2 of 3 this week', at: { top: 40, right: -12 } }]}>
        <span className="marker">For private soccer trainers</span>
        <h1 className="site-wide mt-5 max-w-[14ch] text-[38px] uppercase leading-[.94] text-white sm:text-[60px]">
          Your players, training <Lime>between sessions.</Lime>
        </h1>
        <p className="mt-6 max-w-[32rem] text-[17px] leading-relaxed text-site-mint sm:text-[19px]">
          You see each player about once a week. The ones who improve are the ones who get touches on the other days.
          Give them drills to do at home, see who did them, and stay in touch until the next session.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/start" className="btn-lime">Get started</Link>
          <a href="#pricing" className="btn-ghost pressable">See pricing</a>
        </div>
      </SiteHero>

      <section className="mt-24">
        <SectionHead eyebrow="Between sessions" title="Your training goes home with them." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Piece title="Their week" tag="Done at home">
            After a session, pick two or three short sessions for the week ahead. Each one is a list of drills with reps and a timer.
            Players check off each session when they finish.
          </Piece>
          <Piece title="Your drills" tag="Your videos">
            Each drill plays your video, so players learn it the way you teach it. Paste a YouTube link, or film it on your phone.
          </Piece>
          <Piece title="Your page" tag="Your name on it">
            One page for everyone you train, at its own address: <b className="text-on-surface">yourname.train.futbol</b>.
            It has your name and colors on it, not ours or a club&rsquo;s.
          </Piece>
          <Piece title="Your players" tag="From any team">
            You send one link. Players or their parents open it and sign in with an email. They&rsquo;re on your list,
            whatever team they play for. There&rsquo;s no app to download and no password.
          </Piece>
          <Piece title="Groups and 1-to-1s" tag="However you train">
            Train small groups, single players, or both. A player can be in more than one group,
            and each player still gets their own week.
          </Piece>
          <Piece title="Your next session" tag="Build on their week">
            Before you see a player, check what they finished that week. You&rsquo;ll know what to build on when they arrive.
          </Piece>
        </div>
      </section>

      <section className="mt-24">
        <SectionHead eyebrow="Your side" title="Know who trained before you see them." />
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="See every player">
            Each player&rsquo;s week is on one line: on track, one behind, or not seen since Tuesday. Players who need a reminder are at the top.
          </Step>
          <Step n="2" title="Send a reminder">
            If a player falls behind, one tap writes the message for you (&ldquo;You&rsquo;re one behind this week. Can you fit one in today?&rdquo;). You can also send a note to a whole group.
          </Step>
          <Step n="3" title="No group chat">
            Notes go from trainer to player only. Players can&rsquo;t reply, so there&rsquo;s nothing to moderate. Every note is saved.
          </Step>
        </ol>
      </section>

      <section id="pricing" className="mt-24 scroll-mt-8">
        <SectionHead eyebrow="Pricing" title="You set the price. You keep most of it.">
          Your players pay you monthly through Train.futbol. We take $5 of each payment, plus 10% of anything above $5. The rest is yours.
        </SectionHead>
        <div className="mt-8 max-w-[40rem]">
          <PriceCalc />
          <ul className="mt-5 space-y-2 text-[14.5px] leading-relaxed text-on-surface-variant">
            <li>No setup fee and no contract. When you remove a player, you stop paying for them the next month.</li>
            <li>Players pay by card. The money goes straight to your bank account, not ours.</li>
          </ul>
        </div>
      </section>

      <section className="mt-24">
        <SectionHead eyebrow="Questions" title="Common questions." />
        <dl className="mt-8 max-w-[44rem] divide-y divide-outline-variant border-y border-outline-variant">
          <Faq q="I only have a few drills. Is that enough?">
            Yes. Three or four sessions you already run are enough to start. You can add more later. We set up your first sessions with you.
          </Faq>
          <Faq q="My drills are already on YouTube.">
            Good. Paste the link and the video plays inside the session. If you want to film new ones, your phone held sideways is good enough.
          </Faq>
          <Faq q="Can I introduce myself to players first?">
            Yes. Make your first session an introduction: a short video of you, what you&rsquo;ll work on over the next few weeks, and one easy drill.
          </Faq>
          <Faq q="Who sees what?">
            You see all your players&rsquo; training. So does anyone you add to help you. Players see only their own training and the notes you send them. Other trainers and your players&rsquo; clubs see nothing.
          </Faq>
          <Faq q="Can I just sign up now?">
            Not yet. We set up each trainer by hand for now, so every page starts with sessions in it. Tell us how you train and we&rsquo;ll email you within a day.
          </Faq>
        </dl>
      </section>

      <DarkCta title="Tell us how you train." href="/start" cta="Get started">
        We&rsquo;ll set up your page and your first sessions with you. Then you send your players the link, and they have drills to do before you see them next.
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
