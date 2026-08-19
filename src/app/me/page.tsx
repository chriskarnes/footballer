import Link from 'next/link';
import { serverClient } from '@/lib/supabase/server';
import { formatTouches } from '@/lib/session-builder';
import { SignIn } from '@/components/SignIn';
import { SignOut } from '@/components/SignOut';
import { ProfileCard } from '@/components/ProfileCard';
import { ProfileSetup, type ProfileValues } from '@/components/ProfileSetup';

/**
 * "Me" is the reorder counter. Signed out it's the sign-in prompt; signed in
 * with nothing to count it's the four setup questions; signed in with history
 * it leads with what you did last, because repeating a session you liked is
 * the single most common thing a returning player wants.
 */
/**
 * The profile columns arrive with supabase/migrations/0001. Until it runs, the
 * full select fails as a unit, so the two columns that predate it are read on
 * their own — the card then shows a name and a foot and omits the rest, which
 * is exactly how it treats any unanswered question.
 */
async function readProfile(db: any, id: string): Promise<ProfileValues | null> {
  const BASE = 'display_name, dominant_foot';
  const { data, error } = await db.from('profiles')
    .select(`${BASE}, age_band, positions, region, club`).eq('id', id).maybeSingle();
  if (!error) return data ?? null;
  const { data: base } = await db.from('profiles').select(BASE).eq('id', id).maybeSingle();
  return base ?? null;
}

export default async function MePage() {
  let user = null as null | { id: string; email?: string };
  let workouts: any[] = [];
  let profile: ProfileValues | null = null;
  let hasPlan = false;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const db = await serverClient();
      const { data } = await db.auth.getUser();
      user = data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null;
      if (user) {
        const [{ data: rows }, prof, { data: plans }] = await Promise.all([
          db.from('workouts').select('*')
            .order('created_at', { ascending: false }).limit(25),
          readProfile(db, user.id),
          db.from('plans').select('id').eq('user_id', user.id).eq('active', true).limit(1),
        ]);
        workouts = rows ?? [];
        profile = prof;
        hasPlan = !!plans?.length;
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
      <div className="app-bar">
        <p className="eyebrow">Your training</p>
        <SignOut />
      </div>

      {/* Who this account is, before what it has done. The stats beneath answer
          "how much have I trained"; this answers "what am I training as", which
          is the thing that decides what a session contains. */}
      <ProfileCard profile={profile} email={user.email} />

      {/* One rhythm for the whole screen: 36px between sections, 12px between a
          section's label and its content. Before this every eyebrow's margin
          utilities were being zeroed by the type layer, so all three sections
          ran together at a flat 12px and nothing read as a group. */}
      <section className="mt-9">
        <p className="eyebrow mb-3">What you&rsquo;ve done</p>
        <div className="grid grid-cols-3 gap-2.5">
          <Stat v={String(done.length)} k="Sessions" />
          <Stat v={`${Math.round(minutes)}m`} k="Minutes" />
          <Stat v={formatTouches(touches)} k="Touches" />
        </div>
      </section>

      {/* The saved week, when there is one. A link rather than a copy of the
          grid: /plan is where a week is read and changed, and two places
          showing the same seven days is two places to keep in step. */}
      {hasPlan && (
        <section className="mt-9">
          <p className="eyebrow mb-3">Your weekly schedule</p>
          <Link href="/plan" className="card pressable flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="h-card">The week you saved</div>
              <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
                Repeating — open it to follow or change it
              </div>
            </div>
            <svg viewBox="0 0 24 24" aria-hidden="true"
                 className="h-4 w-4 shrink-0 text-on-surface-variant" fill="none"
                 stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </section>
      )}

      <section className="mt-9">
      <p className="eyebrow mb-3">Do it again</p>
      {!workouts.length && (
        <p className="text-sm text-on-surface-variant">
          Nothing yet. <Link href="/" className="font-bold text-primary">Build a session →</Link>
        </p>
      )}
      <div className="grid grid-cols-1 gap-2">
        {workouts.map((w) => (
          <div key={w.id} className="card flex items-center gap-4 p-4">
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
      </section>

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
