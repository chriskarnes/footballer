import Link from 'next/link';
import { serverClient } from '@/lib/supabase/server';
import { formatTouches } from '@/lib/session-builder';
import { SignIn } from '@/components/SignIn';
import { ProfileSetup } from '@/components/ProfileSetup';

/**
 * "Me" is the reorder counter. Signed out it's the sign-in prompt; signed in
 * with nothing to count it's the four setup questions; signed in with history
 * it leads with what you did last, because repeating a session you liked is
 * the single most common thing a returning player wants.
 */
export default async function MePage() {
  let user = null as null | { id: string; email?: string };
  let workouts: any[] = [];
  let profile: { display_name?: string | null } | null = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const db = await serverClient();
      const { data } = await db.auth.getUser();
      user = data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null;
      if (user) {
        const [{ data: rows }, { data: prof }] = await Promise.all([
          db.from('workouts').select('*')
            .order('created_at', { ascending: false }).limit(25),
          // Only the column that decides which screen this is. Selecting the
          // setup fields here would make the page depend on the migration.
          db.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
        ]);
        workouts = rows ?? [];
        profile = prof ?? null;
      }
    } catch { /* not configured yet */ }
  }

  if (!user) {
    return (
      <div>
        <p className="eyebrow mb-3">Your training</p>
        <h1 className="h-hero">Keep every<br />session</h1>
        <p className="mt-3.5 max-w-[32ch] text-[15px] leading-relaxed text-on-surface-variant">
          Sign in to build a history, repeat a session you liked, and save a weekly plan.
        </p>
        <div className="mt-5"><SignIn /></div>
        <p className="mt-4 text-xs text-on-surface-variant">
          You don&rsquo;t need an account to train — the coach works signed out.
        </p>
      </div>
    );
  }

  // Signed in, nothing done, nothing said about themselves: this is a new
  // account, and the four questions are worth more than an empty history list.
  // Having trained already outranks an unfinished profile — someone mid-session
  // should not be sent back to a form.
  if (!profile?.display_name && !workouts.length) {
    return <ProfileSetup email={user.email} />;
  }

  const done = workouts.filter((w) => w.status === 'completed');
  const touches = done.reduce((a, w) => a + (w.actual_touches ?? w.planned_touches ?? 0), 0);
  const minutes = done.reduce((a, w) => a + Number(w.actual_minutes ?? w.planned_minutes ?? 0), 0);

  return (
    <div>
      <p className="eyebrow mb-3">Your training</p>
      <h1 className="h-page">{user.email}</h1>

      <div className="mt-6 grid grid-cols-3 gap-2.5">
        <Stat v={String(done.length)} k="Sessions" />
        <Stat v={`${Math.round(minutes)}m`} k="Minutes" />
        <Stat v={formatTouches(touches)} k="Touches" />
      </div>

      <p className="eyebrow mb-3 mt-9">Do it again</p>
      {!workouts.length && (
        <p className="mt-2 text-sm text-on-surface-variant">
          Nothing yet. <Link href="/" className="font-bold text-primary">Build a session →</Link>
        </p>
      )}
      <div className="mt-2 grid grid-cols-1 gap-2">
        {workouts.map((w) => (
          <div key={w.id} className="card flex items-center gap-4 p-4 transition active:scale-[.99]">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{w.title}</div>
              <div className="text-xs text-on-surface-variant">
                {new Date(w.created_at).toLocaleDateString()} ·{' '}
                {w.status === 'completed' ? 'completed' : 'saved'} ·{' '}
                {Math.round(Number(w.planned_minutes ?? 0))}m
                {w.planned_touches ? ` · ⚽ ${formatTouches(w.planned_touches)}` : ''}
              </div>
            </div>
            <Link href={`/session/${w.id}?from=history`} className="btn-primary px-3 py-2 text-xs">
              Again
            </Link>
          </div>
        ))}
      </div>

      {done.length >= 3 && (
        <div className="mt-9 rounded-large-increased border border-primary bg-primary-container p-5">
          <div className="h-card">Make this a weekly routine?</div>
          <p className="mt-1 text-sm text-on-surface-variant">
            You&rsquo;ve trained {done.length} times. I can turn what you&rsquo;ve been doing into a
            repeating week — most of the questions are already answered by your history.
          </p>
          <Link href="/plan" className="btn-primary mt-3 px-4 py-2 text-sm">
            Build my weekly schedule →
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="card p-4">
      <div className="font-brand text-[21px] font-bold leading-none tracking-tighter">{v}</div>
      <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">{k}</div>
    </div>
  );
}
