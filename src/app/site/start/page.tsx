import { StartForm } from '@/components/site/StartForm';

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
    <section className="grid gap-10 pt-14 sm:pt-20 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <p className="eyebrow mb-4">Get started</p>
        <h1 className="max-w-[14ch] font-brand text-[40px] font-extrabold leading-[1.04] tracking-tightest text-on-surface sm:text-[52px]">
          Tell us how you train.
        </h1>
        <p className="mt-5 max-w-[30rem] text-[17px] leading-relaxed text-on-surface-variant">
          We set every page up with its trainer, so no player opens it to find nothing there. Here&rsquo;s what happens:
        </p>
        <ol className="mt-6 max-w-[30rem] space-y-4 text-[15px] leading-relaxed text-on-surface-variant">
          <li><b className="text-on-surface">A short call.</b> What you train, who, and how often you see them.</li>
          <li><b className="text-on-surface">Your first sessions.</b> We build three or four together from the drills you already use, with your YouTube clips or new ones filmed on your phone.</li>
          <li><b className="text-on-surface">Your link.</b> Send it to your players. They&rsquo;re in.</li>
        </ol>
      </div>
      <StartForm slug={claim} />
    </section>
  );
}
