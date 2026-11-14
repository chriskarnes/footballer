import { Suspense } from 'react';
import Link from 'next/link';
import { getViewer } from '@/lib/viewer';
import { SignIn } from './SignIn';
import { BandTag, BandTitle, BrandBand } from './BrandBand';
import { NoteBanner } from './NoteBanner';
import { TrainerWeek } from './TrainerWeek';
import { getMyWeek, getPlayerState, getTrainer } from '@/lib/player-week';
import { speedAllowed } from '@/lib/speed-gate';
import { Waiting } from './Waiting';
import { SpeedInvite } from './SpeedInvite';
import { SignOut } from './SignOut';
import { StartOnYourOwn } from './StartOnYourOwn';

/**
 * What Train, Library and Plan show in an academy that doesn't have the drill
 * library — every academy but the demo. With a week from their trainer,
 * that's the page, and its band has the way on once the week is done; without
 * one, a placeholder. Speed & Stamina is the platform's own and works
 * everywhere, so it's the way forward from there, when their trainer offers it.
 *
 * Someone signed out, or signed in but not in this academy, has no trainer
 * yet: they're told how in, not that a trainer hasn't set anything.
 */
/** `next` is where signing in returns: the tab this was shown on. */
export async function LibraryLocked({ title, next = '/' }: { title: string; next?: string }) {
  const v = await getViewer().catch(() => null);
  // Self-serve (0030): there's no trainer to ask. Open, it's one tap in;
  // closed, it's by invite link only, and says so.
  if (v?.academy?.selfServe && !v.role) {
    return (
      <div className="animate-pop">
        <BrandBand>
          <BandTag>{title}</BandTag>
          <BandTitle>Train on your own</BandTitle>
          <p className="mt-3 text-title-sm font-semibold text-on-surface-brand-variant">
            No trainer needed. Build your own sessions, plan your week around your games, and track your speed.
          </p>
        </BrandBand>
        {!v.user ? (
          <div className="mt-5">
            <SignIn next={next} title={v.academy.open ? 'Sign in to start' : 'Sign in'} />
            {!v.academy.open && (
              <p className="mt-5 text-center text-body text-on-surface-variant">Invite only for now. Got a link? Open it to join.</p>
            )}
          </div>
        ) : v.academy.open ? (
          <div className="mt-6"><StartOnYourOwn /></div>
        ) : (
          <p className="mt-5 text-center text-body text-on-surface-variant">Invite only for now. Got a link? Open it to join.</p>
        )}
        {v.user && (
          <p className="mt-5 text-center text-body text-on-surface-variant">
            Signed in as {v.user.email}. Not you? <SignOut to={next} className="pressable font-semibold text-on-surface underline underline-offset-4" />
          </p>
        )}
      </div>
    );
  }
  if (v?.academy && (!v.user || !v.role)) {
    // Asked already: they're waiting on the trainer, not being told to ask.
    const req = v.user
      ? (await v.db.from('join_requests').select('*').eq('academy_id', v.academy.id).eq('user_id', v.user.id).maybeSingle()).data as { declined_at?: string | null; role?: string } | null
      : null;
    const asked = !!req && !req.declined_at;
    // Turned down (0027): say so, rather than the first-time "Ask to join".
    const declined = !!req?.declined_at;
    if (asked) return (
      <div className="animate-pop">
        <BrandBand>
          <BandTag>{title}</BandTag>
          <BandTitle>Asked</BandTitle>
          <p className="mt-3 text-title-sm font-semibold text-on-surface-brand-variant">
            {req.role === 'trainer'
              ? `${v.academy.name}’s owner lets trainers in. Once they do, you’ll see every player here.`
              : `${v.academy.name} decides. Once you’re in, your sessions are here.`}
          </p>
        </BrandBand>
        {/* A family phone: whose request this is, and the way out. */}
        <p className="mt-5 text-center text-body text-on-surface-variant">
          Signed in as {v.user?.email}. Not you? <SignOut to={next} className="pressable font-semibold text-on-surface underline underline-offset-4" />
        </p>
      </div>
    );
    return (
      <div className="animate-pop">
        <BrandBand>
          <BandTag>{title}</BandTag>
          <BandTitle>{declined ? 'Not let in' : v.user ? 'Ask to join' : 'Sign in'}</BandTitle>
          <p className="mt-3 text-title-sm font-semibold text-on-surface-brand-variant">
            {declined ? `${v.academy.name} didn’t let this account in. If that was a mistake, check with them and ask again.`
              : v.user ? `Your sessions from ${v.academy.name} appear here once you’re in.`
                    : `Your sessions from ${v.academy.name} are here once you sign in.`}
          </p>
        </BrandBand>
        {!v.user && <div className="mt-5"><SignIn next={next} /></div>}
        <p className="mt-5 text-center text-body text-on-surface-variant">
          {v.user ? 'Got a link from your trainer? Open it. ' : 'New here? '}
          <Link href="/request" className="font-semibold text-on-surface underline underline-offset-4">{declined ? 'Ask again' : 'Ask to join'}</Link>
        </p>
      </div>
    );
  }
  // A trainer looking at the player side, with nothing set for themselves.
  if (v?.staff) {
    return (
      <div className="animate-pop">
        <BrandBand>
          <BandTag>{title}</BandTag>
          <BandTitle>Player view</BandTitle>
          <p className="mt-3 text-title-sm font-semibold text-on-surface-brand-variant">
            Your players see the sessions you set them here.
          </p>
        </BrandBand>
        <Link href="/coach" className="btn-primary pressable mt-6 w-full">Back to your players</Link>
      </div>
    );
  }
  // A player with nothing set this week hears from their trainer, not Speed.
  const state = await getPlayerState().catch(() => ({ kind: 'none' }) as const);
  if (state.kind === 'new' || state.kind === 'waiting') return <Waiting state={state} />;
  // What their trainer has set them is the page, when there's anything.
  const week = await getMyWeek().catch(() => null);
  if (week) return <div className="animate-pop"><TrainerWeek week={week} /></div>;
  const [speed, trainer] = await Promise.all([speedAllowed().catch(() => true), getTrainer().catch(() => null)]);
  return (
    <div className="animate-pop">
      <BrandBand>
        <BandTag>{title}</BandTag>
        <BandTitle>Nothing yet</BandTitle>
        <p className="mt-3 text-title-sm font-semibold text-on-surface-brand-variant">
          Your trainer hasn&rsquo;t set this week yet.
        </p>
      </BrandBand>
      <Suspense fallback={null}><NoteBanner /></Suspense>
      {speed && <SpeedInvite trainer={trainer?.name ?? null} className="mt-6" />}
    </div>
  );
}
