import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignIn } from '@/components/SignIn';
import { Brand } from '@/components/Brand';
import { ClaimButton } from '@/components/ClaimButton';
import { getViewer } from '@/lib/viewer';
import { academyOrigin } from '@/lib/tenant';

export const metadata = { title: 'Your academy', robots: { index: false } };

type Claim = { slug: string; name: string; trainer: string; hint: string; claimed: boolean };

/**
 * /claim/<code>: the link a trainer gets once their request is approved. On
 * their academy's own address, since the sign-in belongs to it: says the
 * academy is ready, signs them in with the email they asked with, and one
 * tap makes them its owner. Then the setup checklist.
 */
export default async function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const v = await getViewer();
  const { data } = /^[a-z0-9]{8,40}$/.test(code) ? await v.db.rpc('claim_preview', { p_code: code }) : { data: null };
  const claim = data as Claim | null;

  if (!claim) {
    return (
      <Shell>
        <h1 className="h-page">This link doesn&rsquo;t work</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
          Check it&rsquo;s the whole link from the email. If it still doesn&rsquo;t open, reply to that email and we&rsquo;ll sort it out.
        </p>
      </Shell>
    );
  }

  // The sign-in that follows belongs to the academy's own address.
  if (claim.slug !== v.slug) {
    const h = await headers();
    const here = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
    redirect(`${academyOrigin(claim.slug, here)}/claim/${code}`);
  }
  if (v.user && v.role === 'owner') redirect('/coach/setup');

  return (
    <div className="animate-pop pb-10">
      <section className="relative isolate -mx-5 px-5 pb-20 pt-6 text-on-surface-brand">
        <div aria-hidden className="grain absolute bottom-0 left-[calc(50%_-_50dvw)] right-[calc(50%_-_50dvw)] -top-24 -z-10 overflow-hidden bg-surface-brand"
             style={{ backgroundImage: 'radial-gradient(70% 60% at 100% 0%, color-mix(in srgb, var(--app-brand-accent) 26%, transparent), transparent 70%)' }} />
        <header className="font-brand text-[19px] font-extrabold tracking-tighter">{claim.name}</header>
        <div className="mt-12">
          <span className="inline-block rounded-md px-2.5 pb-1 pt-1.5 font-brand text-[11.5px] font-extrabold uppercase tracking-[.14em]"
                style={{ fontStretch: '140%', background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }}>
            {claim.claimed ? 'Already claimed' : 'Your academy is ready'}
          </span>
          <h1 className="site-wide mt-4 text-[38px] uppercase leading-[.95]">
            {claim.claimed ? claim.name : `Welcome, ${claim.trainer}`}
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-on-surface-brand-variant">
            {claim.claimed
              ? `${claim.name} already has its owner.`
              : `${claim.name} lives at ${claim.slug}.train.futbol. Make it yours, then a short checklist gets your first sessions in before your players arrive.`}
          </p>
        </div>
      </section>

      <div className="relative -mt-12">
        <div className="card p-5">
          {claim.claimed ? (
            <>
              <p className="text-[15px] leading-relaxed text-on-surface">
                If that&rsquo;s you, sign in with the email you asked with.
              </p>
              {v.user
                ? <Link href={v.staff ? '/coach' : '/'} className="btn-primary pressable mt-4 w-full">Open the app</Link>
                : <div className="mt-4"><SignIn next="/coach" /></div>}
            </>
          ) : v.user ? (
            <ClaimButton code={code} name={claim.name} email={v.user.email ?? ''} hint={claim.hint} />
          ) : (
            <SignIn next={`/claim/${code}`} title="Sign in to make it yours"
                    note={`Use the email you asked with: ${claim.hint}`} />
          )}
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-pop">
      <header className="app-bar"><Brand small /></header>
      <div className="mt-10"><p className="eyebrow mb-3">Your academy</p>{children}</div>
    </div>
  );
}
