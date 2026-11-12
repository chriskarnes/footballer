import { Suspense } from 'react';
import type { PlayerState } from '@/lib/player-week';
import { Avatar } from './Avatar';
import { AddSession } from './AddSession';
import { BandTag, BandTitle, BrandBand } from './BrandBand';
import { NoteBanner } from './NoteBanner';
import { SoccerDaysPanel } from './SoccerDays';

type Wait = Extract<PlayerState, { kind: 'new' | 'waiting' }>;

/** The line that says what's happening, in the trainer's name: Train and Me both use it. */
export function waitingLine(s: Wait) {
  const who = s.trainer.name ?? 'Your trainer';
  return s.kind === 'new' ? `${who} is getting your training ready.` : `${who} hasn’t set this week yet.`;
}

/**
 * Train for a player with nothing set this week: a new player, or one whose
 * trainer hasn't set the week yet. It says so, with the trainer's face, and
 * offers the one thing worth doing meanwhile, their team's days, which is
 * what the week gets fitted around. No empty week, no drill builder, no
 * Speed: none of it is from their trainer, and an empty week reads as behind.
 */
export function Waiting({ state }: { state: Wait }) {
  const { week, trainer } = state;
  const meets = week.groups.find((g) => g.when)?.when ?? null;
  return (
    <div className="animate-pop">
      <BrandBand>
        <BandTag>{state.kind === 'new' ? 'Welcome' : 'This week'}</BandTag>
        <BandTitle>{state.kind === 'new' ? 'You’re in!' : 'Nothing yet'}</BandTitle>
        <div className="mt-5 flex items-center gap-3.5">
          {(trainer.name || trainer.photo) && <Avatar name={trainer.name} src={trainer.photo} className="h-14 w-14 text-[20px]" onBrand />}
          <p className="min-w-0 text-[17px] font-semibold leading-snug text-on-surface-brand">{waitingLine(state)}</p>
        </div>
        {meets && (
          <p className="mt-4 text-[16px] font-semibold text-on-surface-brand-variant">
            Next with {trainer.name ?? 'your trainer'}: {meets}
          </p>
        )}
      </BrandBand>

      {/* A note from the trainer outranks everything else on the page. */}
      <Suspense fallback={null}><NoteBanner /></Suspense>

      {/* Asked here first; once answered, the week stays on show, so they
          can see what they told us. */}
      <section className="mt-6">
        <h2 className="h-sec">{week.schedule ? 'Team practice & games' : 'While you wait'}</h2>
        {!week.schedule && (
          <p className="mt-1.5 text-[16px] font-medium leading-snug text-on-surface-variant">
            Tell us your team&rsquo;s days, and your sessions will go around them.
          </p>
        )}
        <div className="mt-4">
          <SoccerDaysPanel club={week.schedule?.club ?? []} game={week.schedule?.game ?? null} set={!!week.schedule} />
        </div>
      </section>

      {/* Their trainer lets them add their own: worth offering while they wait. */}
      {week.more && !week.more.why && <AddSession why={null} />}
    </div>
  );
}
