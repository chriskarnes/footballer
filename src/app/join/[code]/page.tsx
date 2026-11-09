import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignIn } from '@/components/SignIn';
import { JoinButton } from '@/components/JoinButton';
import { getViewer } from '@/lib/viewer';
import { academyOrigin } from '@/lib/tenant';

export const metadata = { title: 'Join', robots: { index: false } };

/**
 * /join/<code>: what a trainer texts a player or parent. Says whose academy
 * it is before asking for anything, then one sign-in and one tap.
 *
 * Opened on the wrong address — a code for Mike's academy at
 * demo.train.futbol — it moves to the right one first, since the sign-in
 * that follows belongs to that subdomain.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const v = await getViewer();
  const { data: invite } = /^[a-z0-9]{8,40}$/.test(code)
    ? await v.db.rpc('invite_preview', { p_code: code })
    : { data: null };

  if (!invite) {
    return (
      <Shell eyebrow="Invite">
        <h1 className="h-page">This link doesn&rsquo;t work</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-on-surface-variant">
          It may have been replaced with a new one. Ask your trainer to send it again.
        </p>
      </Shell>
    );
  }

  const { slug, name, role } = invite as { slug: string; name: string; role: 'player' | 'trainer' };
  if (slug !== v.slug) {
    const h = await headers();
    const here = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
    redirect(`${academyOrigin(slug, here)}/join/${code}`);
  }

  const as = role === 'trainer' ? 'a trainer' : 'a player';
  const already = v.role && (v.role !== 'player' || role === 'player');

  return (
    <Shell eyebrow={name}>
      <h1 className="h-hero">Join {name}</h1>
      <p className="mt-3.5 max-w-[32ch] text-[15px] leading-relaxed text-on-surface-variant">
        {role === 'trainer'
          ? 'You’ll see every player’s progress and can send them notes.'
          : 'Your trainer will see the sessions you finish and can send you notes. Everything else works as before.'}
      </p>
      <div className="mt-6">
        {!v.user ? (
          <>
            <p className="mb-3 text-[13.5px] text-on-surface-variant">Sign in with your email to join as {as}.</p>
            <SignIn next={`/join/${code}`} />
          </>
        ) : already ? (
          <>
            <p className="text-[15px] font-semibold text-on-surface">You&rsquo;re already in.</p>
            <Link href={v.staff ? '/coach' : '/'} className="btn-primary pressable mt-4 w-full">
              {v.staff ? 'Go to your players' : 'Start training'}
            </Link>
          </>
        ) : (
          <JoinButton code={code} label={`Join as ${as}`} email={v.user.email ?? ''} />
        )}
      </div>
    </Shell>
  );
}

function Shell({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return <div className="animate-pop pt-8"><p className="eyebrow mb-3">{eyebrow}</p>{children}</div>;
}
