import Link from 'next/link';
import { serverClient } from '@/lib/supabase/server';
import { SignIn } from '@/components/SignIn';
import { ProfileCard } from '@/components/ProfileCard';
import { ThisWeek } from '@/components/ThisWeek';
import { WorkoutList } from '@/components/WorkoutList';
import { AccountSection } from '@/components/AccountSection';
import { finishedRows, readWorkouts, toFinished, toRow, type WorkoutRaw } from '@/lib/workout-rows';
import type { DayRow } from '@/lib/plan-today';
import pkg from '../../../package.json';
import { ProfileSetup, type ProfileValues } from '@/components/ProfileSetup';
import { SavedPlans, type SavedPlan } from '@/components/SavedPlans';

/**
 * "Me" is the reorder counter. Signed out it's the sign-in prompt; signed in
 * with nothing to count it's the four setup questions; signed in with history
 * it reads, top to bottom:
 *
 *   who you are      the name as the headline, then the profile
 *   this week        sessions, minutes, touches, the streak, the followed week
 *   saved sessions   kept from Train to do later
 *   your plans       every saved week
 *   history          the last five, and See all
 *   account          email, add to home screen, sign out
 *
 * Saved and finished sessions used to share one "Do it again" list, so a
 * session you meant to do sat between ones you'd done, looking the same.
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
  let workouts: WorkoutRaw[] = [];
  let profile: ProfileValues | null = null;
  let plans: SavedPlan[] = [];
  let planDays: DayRow[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const db = await serverClient();
      const { data } = await db.auth.getUser();
      user = data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null;
      if (user) {
        const [rows, prof, { data: planRows }] = await Promise.all([
          readWorkouts(db),
          readProfile(db, user.id),
          db.from('plans').select('id,name,active,created_at').eq('user_id', user.id)
            .order('active', { ascending: false }).order('created_at', { ascending: false }),
        ]);
        workouts = rows;
        profile = prof;
        plans = planRows ?? [];
        const followed = plans.find((p) => p.active);
        if (followed) {
          const { data: days } = await db.from('plan_days')
            .select('weekday,slot,kind,session_id').eq('plan_id', followed.id);
          planDays = days ?? [];
        }
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

  const finished = finishedRows(workouts);
  const saved = workouts.filter((w) => w.status !== 'completed').map(toRow);
  const followed = plans.find((p) => p.active);
  const allTime = {
    sessions: finished.length,
    minutes: finished.reduce((a, w) => a + w.minutes, 0),
    touches: finished.reduce((a, w) => a + w.touches, 0),
  };
  const completions = workouts
    .filter((w) => w.status === 'completed' && w.source === 'library')
    .map((w) => ({ source_ref: w.source_ref, completed_at: w.completed_at }));

  return (
    <div>
      <p className="eyebrow mb-3">Your training</p>
      <ProfileCard profile={profile} email={user.email} />

      <ThisWeek finished={finished.map(toFinished)} allTime={allTime}
        plan={followed ? { name: followed.name, days: planDays, completions } : null} />

      {/* Kept from Train for later. Starting one and finishing it moves it
          down into history; removing it is for the ones you won't. */}
      {!!saved.length && (
        <section className="mt-9">
          <p className="eyebrow mb-3">Saved sessions</p>
          <WorkoutList rows={saved} kind="saved" />
        </section>
      )}

      {/* Every saved week, the followed one first. */}
      {!!plans.length && <SavedPlans plans={plans} />}

      {/* The invitation to a plan, once there's enough history to build one
          from. An ordinary card and a ghost button, like every other
          invitation in the app — it had its own outlined, tinted style. */}
      {finished.length >= 3 && !plans.length && (
        <section className="card mt-9 p-5">
          <div className="h-card">Make this a weekly routine?</div>
          <p className="mt-1 text-[13.5px] leading-snug text-on-surface-variant">
            You&rsquo;ve trained {finished.length} times. Your history already answers most of
            the questions, so a repeating week is a couple of taps away.
          </p>
          <Link href="/plan" className="btn-ghost mt-4 w-full">Build my week</Link>
        </section>
      )}

      <section className="mt-9">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="eyebrow">History</p>
          {finished.length > HISTORY_ON_ME && (
            <Link href="/me/history"
                  className="text-[13px] font-semibold text-primary underline underline-offset-4">
              See all {finished.length}
            </Link>
          )}
        </div>
        {finished.length ? (
          <WorkoutList rows={finished.slice(0, HISTORY_ON_ME)} kind="history" />
        ) : (
          <p className="pl-1 text-[13.5px] text-on-surface-variant">
            Nothing finished yet. <Link href="/" className="font-bold text-primary">Build a session</Link>
          </p>
        )}
      </section>

      <AccountSection email={user.email} version={pkg.version} />
    </div>
  );
}

/** Enough to find the session you did last week; the rest is a tap away. */
const HISTORY_ON_ME = 5;
