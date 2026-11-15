import Link from 'next/link';
import { Contact, LegalPage, LegalSection, PostalAddress } from '@/components/site/Legal';

export const metadata = {
  title: 'Terms · Train.futbol',
  description: 'The terms for using Train.futbol, for players, parents and trainers.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms"
      intro="These are the terms for using Train.futbol. By making an account or using the app, you agree to them. If you&rsquo;re under 18, a parent or guardian agrees for you.">

      <LegalSection title="What it is">
        <p>Train.futbol lets a soccer trainer give players drills and sessions to do on their own, and lets players keep track of what they&rsquo;ve done. Each trainer runs their own page (an &ldquo;academy&rdquo;). We provide the app; the trainer decides what their players are asked to do.</p>
      </LegalSection>

      <LegalSection title="Accounts">
        <ul>
          <li>Use your own email address, and keep access to it: it&rsquo;s how you sign in.</li>
          <li>For a player under 13, a parent or guardian makes and holds the account.</li>
          <li>You can leave an academy or delete your account at any time, under Me.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Training safely">
        <p>The drills are physical exercise. Train in a safe space, within your own ability, and stop if something hurts. A young player should have an adult who knows what they&rsquo;re doing and where. The app isn&rsquo;t medical advice, and nothing in it replaces a doctor, a physio or a coach who is there in person.</p>
      </LegalSection>

      <LegalSection title="For trainers">
        <ul>
          <li>You&rsquo;re responsible for what you add: drills, videos, notes and branding. Add only what you have the right to use.</li>
          <li>Invite only players you train, with a parent&rsquo;s agreement for anyone under 13.</li>
          <li>Use what you see about your players (names, email addresses, training) only to train them. Don&rsquo;t share it or use it for anything else.</li>
          <li>You own what you add. You let us store and show it to your players so the app can work.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Using it fairly">
        <p>Don&rsquo;t try to get into anyone else&rsquo;s account or academy, don&rsquo;t copy the drill library out of the app, don&rsquo;t overload or interfere with the service, and don&rsquo;t use it to send anything abusive or unlawful. We can suspend or close an account that does.</p>
      </LegalSection>

      <LegalSection title="The service">
        <p>We work to keep the app running and your information safe, but it&rsquo;s provided as it is: we can&rsquo;t promise it will always be available or free of mistakes. To the extent the law allows, we aren&rsquo;t liable for losses that come from using it or from not being able to. Nothing here takes away rights the law gives you that can&rsquo;t be waived.</p>
        <p>We may change or stop parts of the app.</p>
      </LegalSection>

      <LegalSection title="Changes and questions">
        <p>When these terms change, the date at the top changes with them. Carrying on using the app after a change means you agree to it.</p>
        <p><Contact about="with any question about these terms" /> How we handle your information is in the <Link href="/privacy" className="font-semibold text-on-surface underline underline-offset-4">privacy policy</Link>.</p>
        <PostalAddress />
      </LegalSection>
    </LegalPage>
  );
}
