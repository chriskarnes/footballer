import Link from 'next/link';
import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import { SignIn } from '@/components/SignIn';
import { AskToJoin } from '@/components/AskToJoin';
import { getViewer } from '@/lib/viewer';
import { SignOut } from '@/components/SignOut';
import { rootHref } from '@/lib/root-link';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Ask to join', robots: { index: false } };

/**
 * For a player who found this academy rather than being sent its link. Sign
 * in, say who you are, and the trainers decide. An invite link skips all this.
 */
export default async function RequestPage() {
  const v = await getViewer();
  // The self-serve space (0030) has no one to ask: Train is its way in.
  if (v.academy?.selfServe) redirect('/');
  if (!v.academy) {
    return (
      <div className="pt-10">
        <h1 className="h-page">Open your trainer&rsquo;s address</h1>
        <p className="mt-2 text-body-lg leading-relaxed text-on-surface-variant">Asking to join happens on your trainer&rsquo;s own page.</p>
        <a href={await rootHref()} className="btn-primary pressable mt-6 w-full">Find your trainer</a>
      </div>
    );
  }

  let pending = false, declined = false;
  let asked: { name: string; message: string | null; as_who?: string | null; role?: string } | null = null;
  if (v.user && !v.role) {
    const { data } = await v.db.from('join_requests').select('*')
      .eq('academy_id', v.academy.id).eq('user_id', v.user.id).maybeSingle();
    // Turned down (0027): said so, with the form to ask again.
    declined = !!(data as { declined_at?: string | null } | null)?.declined_at;
    pending = !!data && !declined;
    asked = data;
  }
  const asTrainer = pending && asked?.role === 'trainer';

  return (
    <div className="animate-pop">
      {/* The academy's colours, like the invite page: this is the other way in. */}
      <BrandBand overlap>
        <BandTag>Ask to join</BandTag>
        <BandTitle>{v.academy.name}</BandTitle>
        <p className="mt-4 text-title-sm leading-relaxed text-on-surface-brand-variant">
          Your trainer lets you in, then your sessions appear here. If they sent you a link, use that instead: it skips this step.
        </p>
      </BrandBand>
      <div className="relative -mt-12">
        {!v.user ? (
          <SignIn next="/request" title="First, sign in" />
        ) : v.role ? (
          <div className="card p-5">
            <div className="h-card">You&rsquo;re already in</div>
            <p className="mt-1 text-body text-on-surface-variant">
              Signed in as {v.user.email}. Not you? <SignOut to="/request" className="pressable font-semibold text-on-surface underline underline-offset-4" />
            </p>
            {!v.staff && (
              <p className="mt-2 text-body text-on-surface-variant">
                Signing up another player? Each player needs their own email: sign out, then join with theirs.
              </p>
            )}
            <Link href={v.staff ? '/coach' : '/'} className="btn-primary pressable mt-4 w-full">
              {v.staff ? 'Go to your players' : 'Start training'}
            </Link>
          </div>
        ) : asTrainer ? (
          <div className="card p-5" role="status">
            <div className="h-card">Asked to train here</div>
            <p className="mt-1 text-body leading-relaxed text-on-surface-variant">
              {v.academy.name}&rsquo;s owner lets trainers in. Once they do, you&rsquo;ll see every player here.
            </p>
            <p className="mt-3 text-body text-on-surface-variant">
              Signed in as {v.user.email}. Not you? <SignOut to="/request" className="pressable font-semibold text-on-surface underline underline-offset-4" />
            </p>
          </div>
        ) : (
          <AskToJoin academy={v.academy.name} email={v.user.email ?? ''} pending={pending} declined={declined}
            initial={asked && !declined ? { name: asked.name, message: asked.message ?? '',
              who: asked.as_who === 'player' || asked.as_who === 'parent' ? asked.as_who : null } : undefined} />
        )}
      </div>
      <p className="mt-6 text-center text-body text-on-surface-variant">
        <Link href="/" className="font-semibold text-on-surface underline underline-offset-4">Back to Train</Link>
      </p>
    </div>
  );
}
