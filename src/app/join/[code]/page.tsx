import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignIn } from '@/components/SignIn';
import { Brand } from '@/components/Brand';
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
        <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-on-surface-variant">
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
    <div className="animate-pop">
      <header className="app-bar"><Brand small /></header>
      <div className="mt-10">
        <p className="eyebrow mb-3">{role === 'trainer' ? 'Trainer invite' : 'You’re invited'}</p>
        <h1 className="h-page">Join {name}</h1>
        <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-on-surface-variant">
          {role === 'trainer'
            ? 'See every player’s progress this week, and send them notes.'
            : 'Train with your own sessions, and your trainer sees what you finish.'}
        </p>
      </div>
      <div className="mt-7">
        {!v.user ? (
          <SignIn next={`/join/${code}`} title={`Join as ${as}`} button="Email me a link" />
        ) : already ? (
          <div className="card p-5">
            <div className="h-card">You&rsquo;re already in</div>
            <p className="mt-1 text-[13.5px] text-on-surface-variant">Signed in as {v.user.email}.</p>
            <Link href={v.staff ? '/coach' : '/'} className="btn-primary pressable mt-4 w-full">
              {v.staff ? 'Go to your players' : 'Start training'}
            </Link>
          </div>
        ) : (
          <JoinButton code={code} label={`Join as ${as}`} email={v.user.email ?? ''} />
        )}
      </div>
    </div>
  );
}

function Shell({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="animate-pop">
      <header className="app-bar"><Brand small /></header>
      <div className="mt-10"><p className="eyebrow mb-3">{eyebrow}</p>{children}</div>
    </div>
  );
}
