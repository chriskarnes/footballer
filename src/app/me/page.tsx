import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import Link from 'next/link';
import { serverClient } from '@/lib/supabase/server';
import { SignIn } from '@/components/SignIn';
import { Avatar } from '@/components/Avatar';
import { SoccerDaysPanel } from '@/components/SoccerDays';
import { getMyWeek, getPlayerState, type MyWeek, type PlayerState } from '@/lib/player-week';
import { waitingLine } from '@/components/Waiting';
import { ThisWeek } from '@/components/ThisWeek';
import { WorkoutList } from '@/components/WorkoutList';
import { AccountSection } from '@/components/AccountSection';
import { finishedRows, readWorkouts, toFinished, toRow, type WorkoutRaw } from '@/lib/workout-rows';
import type { DayRow } from '@/lib/plan-today';
import pkg from '../../../package.json';
import { ProfileSetup, type ProfileValues } from '@/components/ProfileSetup';
import { SavedPlans, type SavedPlan } from '@/components/SavedPlans';
import { CalendarSection, type CalendarFeed } from '@/components/CalendarSection';
import { NoteBanner } from '@/components/NoteBanner';
import { getViewer } from '@/lib/viewer';
import { avatarSrc } from '@/lib/avatar';

/**
 * "Me" is the reorder counter. Signed out it's the sign-in prompt; signed in
 * with nothing to count it's the four setup questions; signed in with history
 * it reads, top to bottom:
 *
 *   who you are      the name and photo, in the band
 *   this week        sessions, minutes, and touches or the streak
 *   team days        which days their own team trains and plays
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

/** When their photo last changed, or null: no photo, or the column isn't there yet (0016). */
async function readAvatarAt(db: any, id: string): Promise<string | null> {
  const { data } = await db.from('profiles').select('avatar_updated_at').eq('id', id).maybeSingle();
  return data?.avatar_updated_at ?? null;
}

export default async function MePage() {
  let user = null as null | { id: string; email?: string };
  let workouts: WorkoutRaw[] = [];
  let profile: ProfileValues | null = null;
  let avatarAt: string | null = null;
  let myWeek: MyWeek | null = null;
  let state: PlayerState = { kind: 'none' };
  let plans: SavedPlan[] = [];
  let planDays: DayRow[] = [];
  let canBrand = false;
  let role: string | null = null;
  // undefined: the calendar table doesn't exist yet (migration 0003), so no
  // section. null: it does, and this player hasn't turned it on.
  let calendar: CalendarFeed | null | undefined;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const db = await serverClient();
      const { data } = await db.auth.getUser();
      user = data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null;
      if (user) {
        const [rows, prof, { data: planRows }, viewer, cal, photoAt, wk, st] = await Promise.all([
          readWorkouts(db),
          readProfile(db, user.id),
          db.from('plans').select('id,name,active,created_at').eq('user_id', user.id)
            .order('active', { ascending: false }).order('created_at', { ascending: false }),
          getViewer(),
          db.from('calendar_feeds').select('token, include_plan, include_speed, start_time, time_zone')
            .eq('user_id', user.id).maybeSingle(),
          readAvatarAt(db, user.id),
          getMyWeek().catch(() => null),
          getPlayerState().catch((): PlayerState => ({ kind: 'none' })),
        ]);
        myWeek = wk;
        state = st;
        avatarAt = photoAt;
        canBrand = viewer.canBrand;
        role = viewer.role;
        if (!cal.error) calendar = cal.data ?? null;
        workouts = rows;
        profile = prof;
        plans = planRows ?? [];
        const activePlan = plans.find((p) => p.active);
        if (activePlan) {
          const { data: days } = await db.from('plan_days')
            .select('weekday,slot,kind,session_id').eq('plan_id', activePlan.id);
          planDays = days ?? [];
        }
      }
    } catch { /* not configured yet */ }
  }

  if (!user) {
    return (
      <div>
        <BrandBand>
          <BandTag>Me</BandTag>
          <BandTitle>Sign in</BandTitle>
          <p className="mt-3 text-[16px] font-semibold text-on-surface-brand-variant">
            Save your sessions and see your week.
          </p>
        </BrandBand>
        <div className="mt-5"><SignIn /></div>
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
  const activePlan = plans.find((p) => p.active);
  const completions = workouts
    .filter((w) => w.status === 'completed' && w.source === 'library')
    .map((w) => ({ source_ref: w.source_ref, completed_at: w.completed_at }));

  const name = profile?.display_name?.trim();
  // Waiting on their trainer: nothing to count yet, and that isn't on them.
  const waiting = state.kind === 'new' || state.kind === 'waiting' ? state : null;

  return (
    <div>
      {/* Who this is, and nothing else: the name is the headline. The rest of
          the profile is a tap away, under Account. */}
      <BrandBand>
        <div className="flex items-center gap-4">
          <Avatar name={name} email={user.email} src={avatarSrc(avatarAt)} className="h-16 w-16 text-[24px]" />
          <h1 className="site-wide min-w-0 flex-1 text-[30px] uppercase leading-[.95] [overflow-wrap:anywhere]">{name || 'Me'}</h1>
        </div>
      </BrandBand>
      <div className="mt-6"><NoteBanner /></div>

      <ThisWeek finished={finished.map(toFinished)} quiet={!!waiting}
        plan={activePlan ? { name: activePlan.name, days: planDays, completions } : null} />

      {/* Their team's days, once answered on Train: it's a setting from then on. */}
      {myWeek?.schedule && (
        <section className="mt-8">
          <h2 className="h-sec mb-3">My team days</h2>
          <SoccerDaysPanel club={myWeek.schedule.club} game={myWeek.schedule.game} set />
        </section>
      )}

      {/* Kept from Train for later. Starting one and finishing it moves it
          down into history; removing it is for the ones you won't. */}
      {!!saved.length && (
        <section className="mt-8">
          <h2 className="h-sec mb-3">Saved for later</h2>
          <WorkoutList rows={saved} kind="saved" />
        </section>
      )}

      {/* Every saved week, the active one first. */}
      {!!plans.length && <SavedPlans plans={plans} />}

      {/* The invitation to a plan, once there's enough history to build one
          from. An ordinary card and a ghost button, like every other
          invitation in the app — it had its own outlined, tinted style. */}
      {finished.length >= 3 && !plans.length && (
        <section className="card mt-8 p-5">
          <div className="h-sec">Want a weekly plan?</div>
          <Link href="/plan" className="btn-ghost mt-4 min-h-[52px] w-full text-[15px] font-bold">Make my week</Link>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="h-sec">Done</h2>
          {finished.length > HISTORY_ON_ME && (
            <Link href="/me/history"
                  className="text-[13px] font-semibold text-primary underline underline-offset-4">
              See all {finished.length}
            </Link>
          )}
        </div>
        {finished.length ? (
          <WorkoutList rows={finished.slice(0, HISTORY_ON_ME)} kind="history" />
        ) : waiting ? (
          <p className="pl-1 text-[15px] font-medium text-on-surface-variant">Nothing yet. {waitingLine(waiting)}</p>
        ) : (
          <p className="pl-1 text-[15px] font-medium text-on-surface-variant">
            Nothing yet. <Link href="/" className="font-bold text-primary underline underline-offset-4">Go train</Link>
          </p>
        )}
      </section>

      {calendar !== undefined && <CalendarSection initial={calendar} />}

      <AccountSection email={user.email} version={pkg.version} canBrand={canBrand} role={role} />
    </div>
  );
}

/** Enough to find the session you did last week; the rest is a tap away. */
const HISTORY_ON_ME = 5;
