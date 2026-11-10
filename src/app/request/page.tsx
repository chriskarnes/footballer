import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { SignIn } from '@/components/SignIn';
import { AskToJoin } from '@/components/AskToJoin';
import { getViewer } from '@/lib/viewer';

export const metadata = { title: 'Ask to join', robots: { index: false } };

/**
 * For a player who found this academy rather than being sent its link. Sign
 * in, say who you are, and the trainers decide. An invite link skips all this.
 */
export default async function RequestPage() {
  const v = await getViewer();
  if (!v.academy) {
    return (
      <div className="pt-10">
        <h1 className="h-page">Open your trainer&rsquo;s address</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">Asking to join happens on your trainer&rsquo;s own page.</p>
      </div>
    );
  }

  let pending = false;
  if (v.user && !v.role) {
    const { data } = await v.db.from('join_requests').select('user_id')
      .eq('academy_id', v.academy.id).eq('user_id', v.user.id).maybeSingle();
    pending = !!data;
  }

  return (
    <div className="animate-pop">
      <header className="app-bar"><Brand small /></header>
      <div className="mt-10">
        <p className="eyebrow mb-3">Ask to join</p>
        <h1 className="h-page">{v.academy.name}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
          Your trainer lets you in, then your sessions appear here. If they sent you a link, use that instead: it skips this step.
        </p>
      </div>
      <div className="mt-7">
        {!v.user ? (
          <SignIn next="/request" title="First, sign in" button="Email me a link" />
        ) : v.role ? (
          <div className="card p-5">
            <div className="h-card">You&rsquo;re already in</div>
            <p className="mt-1 text-[13.5px] text-on-surface-variant">Signed in as {v.user.email}.</p>
            <Link href={v.staff ? '/coach' : '/'} className="btn-primary pressable mt-4 w-full">
              {v.staff ? 'Go to your players' : 'Start training'}
            </Link>
          </div>
        ) : (
          <AskToJoin academy={v.academy.name} email={v.user.email ?? ''} pending={pending} />
        )}
      </div>
    </div>
  );
}
