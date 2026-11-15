import Link from 'next/link';
import { SectionHead } from '@/components/site/SiteChrome';
import { DarkCta, Lime, SiteHero } from '@/components/site/Photo';

export const metadata = {
  title: 'For trainers · Train.futbol',
  description: 'For private soccer trainers. Give your players drills to do at home between sessions, see who did them, and stay in touch all week. Free for trainers.',
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
          <Piece title="Their week">
            After a session, pick two or three short sessions for the week ahead. Players check off each one when they finish.
          </Piece>
          <Piece title="Your drills">
            Build sessions from the drills you already teach. Set the reps and the time for each one, and add a video if you have it.
          </Piece>
          <Piece title="Who trained this week">
            Each player&rsquo;s week is on one line: on track, one behind, or not seen since Tuesday. Check it before you see them next.
          </Piece>
          <Piece title="Notes and reminders">
            If a player falls behind, one tap writes the reminder for you. Notes go one way, so there&rsquo;s no group chat to manage.
          </Piece>
          <Piece title="Groups and individual players">
            Train small groups, individual players, or both. A player can be in more than one group and still gets their own week.
          </Piece>
          <Piece title="Your page">
            Your page at <b className="text-on-surface">yourname.train.futbol</b>, with your name and colors.
            Players join from one link, no app needed.
          </Piece>
        </div>
      </section>

      <section id="pricing" className="mt-24 scroll-mt-8">
        <SectionHead eyebrow="Pricing" title="Free for trainers.">
          Your players&rsquo; families pay $10 a month for each player, after 14 days free. You pay nothing, and there&rsquo;s nothing for you to collect.
        </SectionHead>
        <div className="mt-8 grid max-w-[44rem] gap-4 sm:grid-cols-2">
          <div className="card p-6 sm:p-7">
            <p className="eyebrow">Families pay</p>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-brand text-[56px] font-extrabold leading-none tracking-brand-snug text-site-ink">$0</span>
              <span className="text-[16px] font-semibold text-on-surface-variant">for you</span>
            </div>
            <p className="mt-4 text-[14.5px] leading-relaxed text-on-surface-variant">
              Each player trains free for 14 days. Then their family adds a card and pays $10 a month to keep going.
              You see who&rsquo;s paying, and a player who leaves stops being charged.
            </p>
          </div>
          <div className="card-flat p-6 sm:p-7">
            <p className="eyebrow">Or you cover it</p>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-brand text-[56px] font-extrabold leading-none tracking-brand-snug text-site-ink">$5</span>
              <span className="text-[16px] font-semibold text-on-surface-variant">per player, per month</span>
            </div>
            <p className="mt-4 text-[14.5px] leading-relaxed text-on-surface-variant">
              Include it in what families already pay you, or in a team&rsquo;s fees. You pay for the players on your page
              and your families pay nothing.
            </p>
          </div>
        </div>
        <ul className="mt-5 max-w-[44rem] space-y-2 text-[14.5px] leading-relaxed text-on-surface-variant">
          <li>No setup fee and no contract, either way. Families can cancel any time.</li>
          <li>Payments are by card, handled by Stripe.</li>
        </ul>
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
          <Faq q="Will my players&rsquo; families pay $10 a month?">
            They get 14 days free first, so they see their child using it before they&rsquo;re asked. It&rsquo;s a small part of what
            a family spends on training, and it comes with your name on it. If you&rsquo;d rather they weren&rsquo;t asked, cover it yourself.
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
        We&rsquo;ll set up your page and first sessions with you. Send your players the link, and they have drills to do before you see them next.
      </DarkCta>
    </>
  );
}

function Piece({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-flat p-6">
      <h3 className="h-card text-on-surface">{title}</h3>
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
