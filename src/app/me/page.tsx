import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import Link from 'next/link';
import { serverClient } from '@/lib/supabase/server';
import { SignIn } from '@/components/SignIn';
import { Avatar } from '@/components/Avatar';
import { SoccerDaysPanel } from '@/components/SoccerDays';
import { getMyWeek, getPlayerState, type MyWeek, type PlayerState } from '@/lib/player-week';
import { waitingLine } from '@/components/Waiting';
import { WorkoutList } from '@/components/WorkoutList';
import { AccountSection } from '@/components/AccountSection';
import { finishedRows, readWorkouts, toRow, type WorkoutRaw } from '@/lib/workout-rows';
import pkg from '../../../package.json';
import { ProfileSetup, type ProfileValues } from '@/components/ProfileSetup';
import { SavedPlans, type SavedPlan } from '@/components/SavedPlans';
import { CalendarSection, type CalendarFeed } from '@/components/CalendarSection';
import { NoteBanner } from '@/components/NoteBanner';
import { getViewer } from '@/lib/viewer';
import { avatarSrc } from '@/lib/avatar';
import { libraryAllowed } from '@/lib/library-gate';
import { speedAllowed } from '@/lib/speed-gate';

/**
 * "Me" is the reorder counter. Signed out it's the sign-in prompt; signed in
 * with nothing to count it's the four setup questions; signed in with history
 * it reads, top to bottom:
 *
 *   who you are      the name and photo, in the band
 *   soccer week      trainer, practice and game days, tapped to change
 *   saved sessions   kept from Train to do later
 *   your plans       every saved week
 *   history          the last five, and See all
 *   account          email, add to home screen, sign out
 *
 * Saved and finished sessions used to share one "Do it again" list, so a
 * session you meant to do sat between ones you'd done, looking the same.
 *
 * It used to open on a row of this week's numbers (sessions, minutes, weeks
 * in a row). Train already shows the week; the tiles said nothing new.
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

/**
 * Whether the first-time questions are still to answer. Not just the name:
 * a player let in from a join request arrives with the name they asked with,
 * and age and position still unasked. A null is unanswered; a missing column
 * (the fallback read above) isn't held against them.
 */
function needsProfile(p: ProfileValues | null): boolean {
  if (!p?.display_name) return true;
  return p.age_band === null || p.positions === null || (Array.isArray(p.positions) && !p.positions.length);
}

/** When their photo last changed, or null: no photo, or the column isn't there yet (0016). */
async function readAvatarAt(db: any, id: string): Promise<string | null> {
  const { data } = await db.from('profiles').select('avatar_updated_at').eq('id', id).maybeSingle();
  return data?.avatar_updated_at ?? null;
}

/** 'parent' when a parent joined for their player (0009); the setup questions then ask about the player. */
async function readSignedUpBy(db: any, id: string): Promise<string | null> {
  const { data } = await db.from('profiles').select('signed_up_by').eq('id', id).maybeSingle();
  return data?.signed_up_by ?? null;
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ auth?: string; next?: string }> }) {
  const sp = await searchParams;
  // Back from a sign-in link that didn't work (see auth/callback).
  const linkFailed = sp.auth === 'error';
  const next = sp.next && /^\/(?!\/)/.test(sp.next) && !sp.next.includes('\\') ? sp.next : '/me';
  let signedUpBy: string | null = null;
  let user = null as null | { id: string; email?: string };
  let workouts: WorkoutRaw[] = [];
  let profile: ProfileValues | null = null;
  let avatarAt: string | null = null;
  let myWeek: MyWeek | null = null;
  let state: PlayerState = { kind: 'none' };
  // Weekly plans are built from the drill library: without it, no plans.
  let library = false;
  let plans: SavedPlan[] = [];
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
        const [rows, prof, { data: planRows }, viewer, cal, photoAt, wk, st, lib, by] = await Promise.all([
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
          libraryAllowed().catch(() => false),
          readSignedUpBy(db, user.id).catch(() => null),
        ]);
        signedUpBy = by;
        library = lib;
        myWeek = wk;
        state = st;
        avatarAt = photoAt;
        canBrand = viewer.canBrand;
        role = viewer.role;
        if (!cal.error) calendar = cal.data ?? null;
        workouts = rows;
        profile = prof;
        plans = planRows ?? [];
      }
    } catch { /* not configured yet */ }
  }

  if (!user) {
    return (
      <div>
        <BrandBand>
          {/* A failed link from the trainer area lands here too: say so in its words. */}
          <BandTag>{next.startsWith('/coach') ? 'Trainer' : 'Me'}</BandTag>
          <BandTitle>Sign in</BandTitle>
          <p className="mt-3 text-title-sm font-semibold text-on-surface-brand-variant">
            {next.startsWith('/coach') ? 'Sign in with your trainer account.' : 'Save your sessions and see your week.'}
          </p>
        </BrandBand>
        {linkFailed && (
          <div className="card mt-5 p-5" role="alert">
            <div className="h-card">That link didn’t work</div>
            <p className="mt-1.5 text-body leading-relaxed text-on-surface-variant">
              Sign-in links work once, for an hour, in the browser you asked from. Send yourself a new one.
            </p>
          </div>
        )}
        <div className="mt-5"><SignIn next={next} /></div>
      </div>
    );
  }

  // Signed in, nothing done, nothing said about themselves: this is a new
  // account, and the four questions are worth more than an empty history list.
  // Having trained already outranks an unfinished profile — someone mid-session
  // should not be sent back to a form.
  // Trainers aren't asked these: their name is asked on the trainer side.
  const staff = role === 'owner' || role === 'trainer';
  if (needsProfile(profile) && !workouts.length && !staff) {
    return (
      <div>
        <BrandBand>
          <BandTag>Welcome</BandTag>
          <BandTitle>{signedUpBy === 'parent' ? 'Set your player up' : 'Let’s set you up'}</BandTitle>
        </BrandBand>
        <ProfileSetup email={user.email} initial={profile ?? undefined} next={library ? '/plan' : '/'} parent={signedUpBy === 'parent'} heading={false} />
      </div>
    );
  }

  const finished = finishedRows(workouts);
  const saved = workouts.filter((w) => w.status !== 'completed').map(toRow);

  const name = profile?.display_name?.trim();
  // Waiting on their trainer: nothing to count yet, and that isn't on them.
  const waiting = state.kind === 'new' || state.kind === 'waiting' ? state : null;

  return (
    <div>
      {/* Who this is, and nothing else: the name is the headline. The rest of
          the profile is a tap away, under Account. */}
      <BrandBand>
        <BandTag>Me</BandTag>
        <div className="mt-4 flex items-center gap-4">
          <Avatar name={name} email={user.email} src={avatarSrc(avatarAt)} className="h-16 w-16 text-display" />
          <h1 className="site-wide min-w-0 flex-1 text-headline-lg uppercase leading-[.95] [overflow-wrap:anywhere]">{name || 'Me'}</h1>
        </div>
      </BrandBand>
      {/* Every section 40px from the last. NoteBanner keeps its own gap below. */}
      <div className="mt-10"><NoteBanner /></div>

      {/* Their soccer days, once answered on Train: it's a setting from then on. */}
      {myWeek?.schedule && (
        <section className="mt-10">
          <h2 className="h-sec mb-3">Your soccer week</h2>
          <SoccerDaysPanel days={myWeek.schedule} />
        </section>
      )}

      {/* Kept from Train for later. Starting one and finishing it moves it
          down into history; removing it is for the ones you won't. */}
      {!!saved.length && (
        <section className="mt-10">
          <h2 className="h-sec mb-3">Saved for later</h2>
          <WorkoutList rows={saved} kind="saved" />
        </section>
      )}

      {/* Every saved week, the active one first. */}
      {library && !!plans.length && <SavedPlans plans={plans} />}

      {/* The invitation to a plan, once there's enough history to build one
          from. An ordinary card and a ghost button, like every other
          invitation in the app — it had its own outlined, tinted style. */}
      {library && finished.length >= 3 && !plans.length && (
        <section className="card mt-10 p-5">
          <div className="h-sec">Want a weekly plan?</div>
          <Link href="/plan" className="btn-ghost mt-4 min-h-13 w-full text-body-lg font-bold">Make my week</Link>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="h-sec">Your training</h2>
          {finished.length > HISTORY_ON_ME && (
            <Link href="/me/history"
                  className="text-body-sm font-semibold text-primary underline underline-offset-4">
              See all {finished.length}
            </Link>
          )}
        </div>
        {finished.length ? (
          <WorkoutList rows={finished.slice(0, HISTORY_ON_ME)} kind="history" />
        ) : waiting ? (
          <p className="pl-1 text-body-lg font-medium text-on-surface-variant">Nothing yet. {waitingLine(waiting)}</p>
        ) : (
          <p className="pl-1 text-body-lg font-medium text-on-surface-variant">
            Nothing yet. <Link href="/" className="font-bold text-primary underline underline-offset-4">Go train</Link>
          </p>
        )}
      </section>

      {calendar !== undefined && <CalendarSection initial={calendar} plan={library} speed={await speedAllowed().catch(() => true)} />}

      <AccountSection email={user.email} version={pkg.version} canBrand={canBrand} role={role} />
    </div>
  );
}

/** Enough to find the session you did last week; the rest is a tap away. */
const HISTORY_ON_ME = 5;
