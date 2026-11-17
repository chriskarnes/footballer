import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import { myProgress } from '@/lib/my-progress';
import { formatTouches } from '@/lib/session-builder';
import { profileMissing } from '@/lib/profile-check';
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
import { safeNext } from '@/lib/safe-next';
import { SignOut } from '@/components/SignOut';
import { rootHref } from '@/lib/root-link';
import { getAcademy } from '@/lib/branding-server';
import { avatarSrc } from '@/lib/avatar';
import { libraryAllowed } from '@/lib/library-gate';
import { speedAllowed } from '@/lib/speed-gate';
import { myMembership } from '@/lib/membership-server';
import { membershipLine } from '@/lib/membership';

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
  // Marked, so the questions aren't asked: there'd be nowhere to save them.
  if (base) BEFORE_0001.add(base);
  return base ?? null;
}
const BEFORE_0001 = new WeakSet<object>();

/**
 * Whether the first-time questions are still to answer. Not just the name:
 * a player let in from a join request arrives with the name they asked with,
 * and age and position still unasked. A null is unanswered; a missing column
 * (the fallback read above) isn't held against them.
 */
const needsProfile = (p: ProfileValues | null) => !(p && BEFORE_0001.has(p)) && profileMissing(p);

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
  const next = safeNext(sp.next, '/me');
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
  let admin = false;
  // On an academy's address (not the bare domain), and staff anywhere.
  let onAcademy = false;
  // The self-serve space (0030): no trainer, so no notes from one.
  let selfServe = false;
  let timeZone = 'UTC';
  let staffAnywhere = false;
  let role: string | null = null;
  let academyName: string | null = null;
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
        admin = viewer.isAdmin;
        onAcademy = !!viewer.academy;
        selfServe = !!viewer.academy?.selfServe;
        timeZone = viewer.academy?.timeZone ?? 'UTC';
        const { data: staffRows } = await db.from('academy_members').select('role').eq('user_id', user.id).in('role', ['owner', 'trainer']).limit(1);
        staffAnywhere = !!staffRows?.length;
        role = viewer.role;
        academyName = viewer.academy?.name ?? null;
        if (!cal.error) calendar = cal.data ?? null;
        workouts = rows;
        profile = prof;
        plans = planRows ?? [];
      }
    } catch { /* not configured yet */ }
  }

  if (!user) {
    // The bare domain has no academy: signing in there doesn't sign you in at one.
    const onAcademyHost = !!(await getAcademy().catch(() => ({ academy: null }))).academy;
    return (
      <div>
        <BrandBand>
          {/* A failed link from the trainer area lands here too: say so in its words. */}
          <BandTag>{next.startsWith('/coach') ? 'Trainer' : next.startsWith('/join') ? 'Joining' : next.startsWith('/claim') ? 'Your academy' : 'Me'}</BandTag>
          <BandTitle>Sign in</BandTitle>
          <p className="mt-3 text-title-sm font-semibold text-on-surface-brand-variant">
            {next.startsWith('/coach') ? 'Sign in with your trainer account.'
              : next.startsWith('/join') ? 'Sign in, then you’re one tap from joining.'
              : next.startsWith('/claim') ? 'Sign in with the email you asked with, then set your academy up.'
              : onAcademyHost ? 'Save your sessions and see your week.' : 'Sign in to your account.'}
          </p>
        </BrandBand>
        {linkFailed && (
          <div className="card mt-5 p-5" role="alert">
            <div className="h-card">That link didn’t work</div>
            <p className="mt-1.5 text-body leading-relaxed text-on-surface-variant">
              Sign-in links work once, for an hour, in the browser you asked from. Asked in the app on your
              home screen? Go back there and type the 6-digit code from the email instead. Or send yourself a new one here.
            </p>
          </div>
        )}
        {/* The bare domain has no week to see: say where training is, every time. */}
        {!onAcademyHost && (
          <p className="card mt-5 p-5 text-body leading-relaxed text-on-surface-variant">
            Training happens on your trainer&rsquo;s own address, and signing in here won&rsquo;t sign you in there.{' '}
            <a href={await rootHref()} className="font-semibold text-on-surface underline underline-offset-4">Find your trainer&rsquo;s address</a>.
          </p>
        )}
        <div className="mt-5"><SignIn next={next} recall={linkFailed} /></div>
      </div>
    );
  }

  // Signed in, nothing done, nothing said about themselves: this is a new
  // account, and the four questions are worth more than an empty history list.
  // Asked even if they've trained already (signed out, before joining):
  // Train sends an unanswered player here, and Me has to be where it's asked.
  // Trainers aren't asked these: their name is asked on the trainer side.
  const staff = role === 'owner' || role === 'trainer';
  // Not on the bare domain (there's no academy to set up for). A trainer elsewhere, here as a player (for their own child, say): asked
  // about their player, without the name, so Train's "answer these first"
  // has somewhere to land.
  // A trainer elsewhere who joins the self-serve space (0030) trains
  // themselves there: their own questions, not a child's.
  const forChild = staffAnywhere && !selfServe;
  // Members only: someone not in this academy yet is told how in first.
  if (needsProfile(profile) && !staff && onAcademy && role) {
    return (
      <div>
        <BrandBand>
          <BandTag>Welcome</BandTag>
          <BandTitle>{signedUpBy === 'parent' || forChild ? 'Set your player up'
            : !signedUpBy && !profile?.age_band && profile?.display_name?.trim() ? `Set ${profile.display_name.trim().split(/\s+/)[0]} up` : 'Let’s set you up'}</BandTitle>
        </BrandBand>
        <ProfileSetup email={user.email} initial={profile ?? undefined} next="/" heading={false} keepName={staffAnywhere}
          parent={forChild || signedUpBy === 'parent' ? true : selfServe && staffAnywhere ? false : signedUpBy === 'player' ? false : null} />
        {/* A shared phone: someone else's half-made account isn't a trap. */}
        <p className="mt-6 text-center text-body text-on-surface-variant">
          Signed in as {user.email}. Not you? <SignOut to="/me" className="pressable font-semibold text-on-surface underline underline-offset-4" />
        </p>
      </div>
    );
  }

  const finished = finishedRows(workouts);
  const progress = myProgress(finished, timeZone);
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
        <section id="saved" className="mt-10 scroll-mt-6">
          <h2 className="h-sec mb-3">Saved for later</h2>
          <WorkoutList rows={saved} kind="saved" />
        </section>
      )}

      {/* Every saved week, the active one first. */}
      {library && !!plans.length && <SavedPlans plans={plans} timeZone={timeZone} />}

      {/* The invitation to a plan, once there's enough history to build one
          from. An ordinary card and a ghost button, like every other
          invitation in the app — it had its own outlined, tinted style. */}
      {library && finished.length >= 3 && !plans.length && (
        <section className="card mt-10 p-5">
          <div className="h-sec">Want a weekly plan?</div>
          <Link href="/plan" className="btn-ghost mt-4 min-h-13 w-full text-body-lg font-bold">Make my week</Link>
        </section>
      )}

      {/* What they have to show for it: this week, the run of weeks, and all of it. */}
      {finished.length > 0 && (
        <section className="mt-10" aria-label="Your progress">
          <dl className="grid grid-cols-3 gap-2.5">
            {([
              [String(progress.thisWeek), progress.thisWeek === 1 ? 'session this week' : 'sessions this week'],
              [String(progress.weeks), progress.weeks === 1 ? 'week in a row' : 'weeks in a row'],
              progress.touches > 0
                ? [formatTouches(progress.touches), 'touches so far']
                : [String(progress.sessions), progress.sessions === 1 ? 'session so far' : 'sessions so far'],
            ] as const).map(([value, label]) => (
              <div key={label} className="card flex flex-col-reverse px-3 py-4 text-center">
                <dt className="mt-1.5 text-body-sm font-semibold leading-tight text-on-surface-variant">{label}</dt>
                <dd className="font-brand text-display-sm font-extrabold leading-none tracking-brand-snug text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
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
            Nothing yet. {onAcademy
              ? <Link href="/" className="font-bold text-primary underline underline-offset-4">Go train</Link>
              : <a href={await rootHref()} className="font-bold text-primary underline underline-offset-4">Find your trainer</a>}
          </p>
        )}
      </section>

      {calendar !== undefined && <CalendarSection initial={calendar} plan={library} speed={await speedAllowed().catch(() => true)} />}

      {await myMembership().then((m) => m && (
        <Link href="/membership" className="card pressable mt-6 flex min-h-14 items-center justify-between gap-4 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-body font-semibold text-on-surface">Membership</span>
            <span className="mt-0.5 block text-body-sm text-on-surface-variant">{membershipLine(m.terms, m.access, m.row)}</span>
          </span>
          <span className="shrink-0 text-body text-on-surface-variant" aria-hidden="true">›</span>
        </Link>
      ))}

      <AccountSection email={user.email} version={pkg.version} canBrand={canBrand} role={selfServe && role === 'player' ? null : role} admin={admin}
                      academy={role ? academyName : null} owner={role === 'owner'}
                      legal={{ privacy: await rootHref('/privacy'), terms: await rootHref('/terms') }} />
    </div>
  );
}

/** Enough to find the session you did last week; the rest is a tap away. */
const HISTORY_ON_ME = 5;
