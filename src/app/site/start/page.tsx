import { StartForm } from '@/components/site/StartForm';
import { Lime, SiteHero } from '@/components/site/Photo';

export const metadata = {
  title: 'Get started · Train.futbol',
  description: 'Private soccer trainers: tell us how you train, and we’ll set up your page. Add your drills and send your players the link.',
};

/**
 * Asked, not signed up: each request is approved by hand, then the trainer
 * gets a claim link and a short setup checklist (coach/setup). The steps
 * here describe that, not a call we don't make.
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
            We look over every request ourselves, then you have your own page within a day or two. Here&rsquo;s how it goes:
          </p>
          <ol className="mt-6 max-w-[30rem] space-y-4 text-[15px] leading-relaxed text-site-mint">
            <li><b className="text-white">Your page.</b> We email you a link to it. Open it and it&rsquo;s yours.</li>
            <li><b className="text-white">Five quick steps.</b> Your name, a few drills you already use, a session, and a program. Use your YouTube videos, or film new ones on your phone.</li>
            <li><b className="text-white">Your link.</b> Send it to your players. They have drills to do before your next session.</li>
          </ol>
        </div>
        <StartForm slug={claim} />
      </div>
    </SiteHero>
  );
}
