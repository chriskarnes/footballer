import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignIn } from '@/components/SignIn';
import { Brand } from '@/components/Brand';
import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
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
      <BrandBand overlap name={claim.name}>
        <BandTag>{claim.claimed ? 'Already claimed' : 'Your academy is ready'}</BandTag>
        <BandTitle>{claim.claimed ? claim.name : `Welcome, ${claim.trainer}`}</BandTitle>
        <p className="mt-4 text-[15.5px] leading-relaxed text-on-surface-brand-variant">
          {claim.claimed
            ? `${claim.name} already has its owner.`
            : `${claim.name} lives at ${claim.slug}.train.futbol. Make it yours, then a short checklist gets your first sessions in before your players arrive.`}
        </p>
      </BrandBand>

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
