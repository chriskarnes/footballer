import { StartForm } from '@/components/site/StartForm';
import { Lime, SiteHero } from '@/components/site/Photo';

export const metadata = {
  title: 'Get started · Train.futbol',
  description: 'Tell us how you train and we’ll set up your page with you.',
};

/**
 * Asked, not signed up: trainers are set up by hand for now, so every page
 * opens with sessions in it. The form is the start of that conversation.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await searchParams;
  const claim = slug && /^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$/.test(slug) ? slug : '';
  return (
    <SiteHero>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <span className="marker">Get started as a trainer</span>
          <h1 className="site-wide mt-5 max-w-[12ch] text-[38px] uppercase leading-[.94] text-white sm:text-[54px]">
            Tell us how you <Lime>train.</Lime>
          </h1>
          <p className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-site-mint">
            We set every page up with its trainer, so it has sessions in it the day your players open it. Here&rsquo;s what happens:
          </p>
          <ol className="mt-6 max-w-[30rem] space-y-4 text-[15px] leading-relaxed text-site-mint">
            <li><b className="text-white">A short call.</b> What you train, who, and how often you see them.</li>
            <li><b className="text-white">Your first sessions.</b> We build three or four together from the drills you already use, with your YouTube clips or new ones filmed on your phone.</li>
            <li><b className="text-white">Your link.</b> Send it to your players. They&rsquo;re in.</li>
          </ol>
        </div>
        <StartForm slug={claim} />
      </div>
    </SiteHero>
  );
}
