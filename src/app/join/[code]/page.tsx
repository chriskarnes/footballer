import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignIn } from '@/components/SignIn';
import { Brand } from '@/components/Brand';
import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import { JoinFlow } from '@/components/JoinFlow';
import { isWho } from '@/lib/who';
import { getBranding } from '@/lib/branding-server';
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
export default async function JoinPage({ params, searchParams }: {
  params: Promise<{ code: string }>; searchParams: Promise<{ as?: string }>;
}) {
  const { code } = await params;
  const v = await getViewer();
  const { data: invite } = /^[a-z0-9]{8,40}$/.test(code)
    ? await v.db.rpc('invite_preview', { p_code: code })
    : { data: null };

  if (!invite) {
    return (
      <Shell eyebrow="Invite">
        <h1 className="h-page">This link doesn&rsquo;t work</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
          It may have been replaced with a new one. Ask your trainer to send it again.
        </p>
      </Shell>
    );
  }

  const { slug, name, role } = invite as { slug: string; name: string; role: 'player' | 'trainer' };
  if (slug !== v.slug) {
    const h = await headers();
    const here = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
    const q = await searchParams;
    redirect(`${academyOrigin(slug, here)}/join/${code}${isWho(q.as) ? `?as=${q.as}` : ''}`);
  }

  const already = v.role && (v.role !== 'player' || role === 'player');
  const brand = await getBranding();
  const shown = brand?.name ?? name;
  const dot = shown.indexOf('.');
  const [head, tail] = dot > 0 ? [shown.slice(0, dot), shown.slice(dot)] : [shown, ''];
  const q = await searchParams;

  return (
    <div className="animate-pop pb-10">
      {/* The academy's own colours, edge to edge, the way the marketing
          pages open: this is the step between the two. */}
      <BrandBand overlap name={brand?.name ? undefined : name}>
        <BandTag>{role === 'trainer' ? 'Trainer invite' : 'You’re invited'}</BandTag>
        <BandTitle>Join {head}{tail && <span className="text-on-surface-brand-variant">{tail}</span>}</BandTitle>
        <p className="mt-4 text-[15.5px] leading-relaxed text-on-surface-brand-variant">
          {role === 'trainer' ? 'See every player’s week, and send them notes.' : 'Your trainer’s sessions, done at home.'}
        </p>
      </BrandBand>

      {/* The card sits across the edge, half in the colour and half out. */}
      <div className="relative -mt-12">
        {v.user && already ? (
          <div className="card p-5">
            <div className="h-card">You&rsquo;re already in</div>
            <p className="mt-1 text-[13.5px] text-on-surface-variant">Signed in as {v.user.email}.</p>
            <Link href={v.staff ? '/coach' : '/'} className="btn-primary pressable mt-4 w-full">
              {v.staff ? 'Go to your players' : 'Start training'}
            </Link>
          </div>
        ) : (
          <JoinFlow code={code} role={role} email={v.user?.email ?? null} initial={isWho(q.as) ? q.as : null} />
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
