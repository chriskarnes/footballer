import Link from 'next/link';
import { Contact, LegalPage, LegalSection, PostalAddress } from '@/components/site/Legal';

export const metadata = {
  title: 'Privacy · Train.futbol',
  description: 'What Train.futbol keeps about players, parents and trainers, who sees it, and how to delete it.',
};

/**
 * What the app keeps and who sees it, in the app's own words. Each line here
 * describes something the code does: change the code, change the line.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy"
      intro="Train.futbol is where a private soccer trainer gives players drills to do between sessions. This page says what we keep about you, who can see it, and how to take it away. We keep what the app needs to work, and nothing to sell or advertise with.">

      <LegalSection title="What we keep">
        <ul>
          <li><b>Your email address</b>, to sign you in. There are no passwords: we email a code and a link.</li>
          <li><b>Your profile</b>: a first name and last initial (we don&rsquo;t keep last names), an age range (not a birthday), positions, stronger foot, and, if you add them, your club, your area and a photo. Players under 13 don&rsquo;t have a photo, club or area.</li>
          <li><b>Whether the account was made by the player or a parent or guardian.</b></li>
          <li><b>For a player under 13</b>, their parent&rsquo;s or guardian&rsquo;s agreement: the email address it came from, when, and how.</li>
          <li><b>Your training</b>: the sessions you finish, when, how long, which drills you ticked, how a session felt, your saved weeks, your Speed test results, and the soccer days you tell us about (practice, games, trainer days).</li>
          <li><b>Notes</b> your trainer sends you, and whether you&rsquo;ve opened them.</li>
          <li><b>Requests</b>: if you ask to join an academy, the name and message you send; if you ask for a trainer page, what you put in that form.</li>
          <li><b>For trainers</b>: the drills, programs, groups and branding you add.</li>
        </ul>
        <p>We don&rsquo;t ask for a home address, a phone number, a date of birth or your location, and the app doesn&rsquo;t track where you are.</p>
      </LegalSection>

      <LegalSection title="Who can see it">
        <ul>
          <li><b>You.</b></li>
          <li><b>The trainers of an academy you join.</b> They see your name, email address, age range, positions, soccer days, the training you do and your Speed test results, so they can set your week and follow how it&rsquo;s going. Trainers in an academy you haven&rsquo;t joined see nothing of yours.</li>
          <li><b>Other players don&rsquo;t.</b> There are no public profiles, no leaderboards and no messaging between players.</li>
          <li><b>The people who run Train.futbol</b>, to keep it working and to help when something goes wrong.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Companies that help us run it">
        <p>We use a small number of companies to run the app. They handle your information only to provide their service to us.</p>
        <ul>
          <li><b>Hosting and the database</b> (currently Vercel and Supabase): everything above is stored and served through them, including the sign-in emails.</li>
          <li><b>AI services</b> (currently Anthropic and Google): if you type what you want to train in your own words, that text is sent to turn it into a session. Players under 13 aren&rsquo;t offered this. When a trainer has the AI help with a player&rsquo;s week, the player&rsquo;s age range, positions and recent session titles are sent with the trainer&rsquo;s drills. Names, email addresses and photos are never sent.</li>
          <li><b>Payments</b> (Stripe): where an academy is paid for by card, Stripe takes the card and the payment on its own pages. We send Stripe the email address of the account that pays and the academy&rsquo;s name, and for a trainer the number of players they pay for. A player&rsquo;s name is never sent. We never see or store the card number; we keep Stripe&rsquo;s reference for the payer and where the subscription stands (free days, paid, ended).</li>
          <li><b>YouTube</b>: drill videos are YouTube&rsquo;s. When you play one, YouTube receives the request and may set its own cookies.</li>
        </ul>
        <p>We don&rsquo;t sell information, we don&rsquo;t show ads, and we don&rsquo;t use advertising or analytics trackers.</p>
      </LegalSection>

      <LegalSection title="On your phone">
        <p>The app keeps a sign-in cookie so you stay signed in, and stores a few things on the device so it works with no signal: pages you&rsquo;ve opened, drills you&rsquo;ve ticked, and sessions waiting to be sent. Signing out clears your saved pages and Speed results from the device.</p>
        <p>If you turn on the calendar link, anyone you give that link to can see your training schedule. You can replace the link or turn it off under Me.</p>
      </LegalSection>

      <LegalSection title="Children">
        <p>Many players are children. A player under 13 can&rsquo;t train until a parent or guardian agrees:</p>
        <ul>
          <li>A player is asked their age before their email. Under 13, a parent or guardian signs up instead, with their own email, and agrees in the app.</li>
          <li>If a player under 13 has an account of their own, they&rsquo;re asked for a parent&rsquo;s or guardian&rsquo;s email, and we send that address a link to agree, or to have the account deleted. We use that address only to ask and to confirm.</li>
          <li>The day after a parent or guardian agrees, we email them to confirm, with how to change their mind.</li>
          <li>If nobody agrees within 30 days, we delete the account, and the parent&rsquo;s or guardian&rsquo;s email address with it.</li>
        </ul>
        <p>For players under 13 we keep less: no photo, club or area, and no typed requests to an AI service. Nothing about them is sold, used for advertising, or shared beyond the trainer and the companies listed above.</p>
        <p>A parent or guardian can see everything kept about their child by signing in to the account, change it under Me, and delete it at any time, which also withdraws their agreement. <Contact about="if you&rsquo;d like us to do any of that for you, or if you believe a child has an account without a parent or guardian knowing" /></p>
      </LegalSection>

      <LegalSection title="Changing and deleting">
        <ul>
          <li><b>Change your details</b> under Me, then My profile.</li>
          <li><b>Leave an academy</b> under Me. Its trainers stop seeing new training; you keep your own history.</li>
          <li><b>Delete your account</b> under Me. That removes your sign-in, profile, photo, training history, saved weeks and memberships straight away, and can&rsquo;t be undone. Copies may stay in our providers&rsquo; routine backups for a short while after.</li>
        </ul>
        <p><b>How long we keep it.</b> We keep your information to run your training, and only while the account is in use. A player&rsquo;s account that goes a year without being used (no sign-in and no training) is deleted, with everything in it; one that&rsquo;s still paying is kept until its payments stop. A player under 13 with no parent&rsquo;s or guardian&rsquo;s agreement after 30 days is deleted, as above. A trainer&rsquo;s account is kept while their academy runs; a trainer who owns an academy should ask us to hand it over or close it before deleting their own account.</p>
      </LegalSection>

      <LegalSection title="Changes and questions">
        <p>When this page changes, the date at the top changes with it.</p>
        <p><Contact about="with any question about your information" /> See also the <Link href="/terms" className="font-semibold text-on-surface underline underline-offset-4">terms</Link>.</p>
        <PostalAddress />
      </LegalSection>
    </LegalPage>
  );
}
