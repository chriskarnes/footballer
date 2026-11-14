import { SignIn } from '@/components/SignIn';
import { getViewer } from '@/lib/viewer';
import { SignOut } from '@/components/SignOut';
import { rootHref } from '@/lib/root-link';
import { headers } from 'next/headers';
import { academyOrigin } from '@/lib/tenant';

/**
 * The trainer area's front door. Returns the viewer when they're staff here,
 * or the page to show instead — each one saying what to do, not just "no".
 */
export async function staffOnly(next: string) {
  const v = await getViewer();
  if (!v.academy) {
    // Signed in: their own academies, by name. One not set up yet isn't
    // listed in Find your academy, so that link alone left a new owner stuck.
    const mine = v.user
      ? ((await v.db.from('academy_members').select('role, academies(slug, name)').eq('user_id', v.user.id).in('role', ['owner', 'trainer'])).data ?? [])
          .map((m) => (m as unknown as { academies: { slug: string; name: string } | null }).academies).filter((a): a is { slug: string; name: string } => !!a)
      : [];
    if (mine.length) {
      const h = await headers();
      const here = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
      return { page: <Note title="Open your academy">The trainer area lives at your academy&rsquo;s own address.
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          {mine.map((a) => <a key={a.slug} href={`${academyOrigin(a.slug, here)}${next}`} className="btn-primary pressable">Open {a.name}</a>)}
        </div>
        <p className="mt-4 text-body-sm">You&rsquo;ll sign in there once: each academy&rsquo;s address keeps its own sign-in.</p></Note> };
    }
    return { page: <Note title="Open your academy">The trainer area lives at your academy&rsquo;s own address, like <b>yourname.train.futbol/coach</b>.
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <a href={await rootHref('/players')} className="btn-ghost pressable">Find your academy</a>
        <a href={await rootHref('/start')} className="btn-ghost pressable">Start an academy</a>
      </div></Note> };
  }
  if (!v.user) {
    return { page: <Note title={`${v.academy.name} trainers`}>Sign in with your trainer account.<div className="mt-5"><SignIn next={next} /></div></Note> };
  }
  if (!v.staff) {
    return { page: <Note title="Trainers only">
      This account ({v.user.email}) isn&rsquo;t a trainer at {v.academy.name}. Sign in with your trainer
      account, or ask the owner for the trainer invite link.
      <div className="mt-5"><SignOut to={next} className="btn-ghost pressable" /></div>
    </Note> };
  }
  return { viewer: v as typeof v & { academy: NonNullable<typeof v.academy>; user: NonNullable<typeof v.user> } };
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-6">
      <p className="eyebrow mb-3">Trainer</p>
      <h1 className="h-page">{title}</h1>
      <div className="mt-3 text-body leading-relaxed text-on-surface-variant">{children}</div>
    </div>
  );
}
