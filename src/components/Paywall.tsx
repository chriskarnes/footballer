'use client';
import Link from 'next/link';
import { MembershipButtons } from './MembershipButtons';
import { Avatar } from './Avatar';
import { Tick } from './TickMark';
import { LegalLinks } from './LegalLinks';

export type PaywallLock = {
  academy: string; price: string; line: string; paused?: boolean;
  /** Whose training it is, where the academy has a trainer to name. */
  trainer?: { name: string | null; photo: string | null } | null;
};

/** What a membership is, as ticked lines: on the paywall and the membership page. */
export function Included({ trainer }: { trainer?: string | null }) {
  const who = trainer ?? 'your trainer';
  return (
    <ul className="mt-5 space-y-3">
      {[`The sessions ${who} sets each week, with the videos`, `${trainer ?? 'Your trainer'} sees what gets finished`, 'Cancel any time'].map((line) => (
        <li key={line} className="flex items-start gap-3 text-body-lg font-medium leading-snug text-on-surface">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-on-surface text-surface"><Tick className="h-3 w-3" /></span>
          {line}
        </li>
      ))}
    </ul>
  );
}

/** Who takes the card, said once, small, where a parent is about to type it. */
export function CardNote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 text-body-sm leading-relaxed text-on-surface-variant">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
      </svg>
      <div>
        <p>A parent or guardian should do this. Cards are taken by Stripe; we never see or store the card number.{children}</p>
        {/* Said where the card is about to go in: it renews, and how to stop it. */}
        <LegalLinks lead="It renews every month until you cancel, under Me, then Membership. By adding a card you agree to the" parentLine={false} />
      </div>
    </div>
  );
}

/**
 * What a player sees in place of their training once their free days are
 * over and there's no card (0038). Says whose training it is and what it
 * costs, and goes straight to the card. Me stays open, to sign out or leave.
 * A player their trainer has switched off sees that said, with nothing to pay.
 */
export function Paywall({ lock }: { lock: PaywallLock }) {
  const t = lock.trainer;
  const face = !!t && (!!t.name || !!t.photo);
  const head = (title: string) => (
    <div className="brand-card px-6 py-7">
      <div className="flex items-center gap-3">
        {face && <Avatar name={t!.name} src={t!.photo} className="h-11 w-11 text-body-lg" onBrand />}
        <p className="text-body font-bold text-on-surface-brand-variant">
          {face && t!.name ? `Training with ${t!.name}` : lock.academy}
          {face && t!.name && <span className="block font-semibold">{lock.academy}</span>}
        </p>
      </div>
      <h1 className="mt-5 font-brand text-display font-extrabold leading-tight tracking-brand-snug text-on-surface-brand">{title}</h1>
      <p className="mt-2 text-body-lg font-medium leading-relaxed text-on-surface-brand-variant">{lock.line}</p>
    </div>
  );
  // Switched off by their trainer (0040): nothing to pay, only to ask.
  if (lock.paused) {
    return (
      <div className="animate-pop pt-6">
        {head('Training is paused')}
        <Link href="/me" className="mt-6 inline-block text-body font-semibold text-on-surface-variant underline underline-offset-4">Your account</Link>
      </div>
    );
  }
  return (
    <div className="animate-pop pt-6">
      {head('Keep training')}
      <div className="card mt-4 p-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-brand text-[44px] font-extrabold leading-none text-on-surface">{lock.price}</span>
          <span className="text-body font-semibold text-on-surface-variant">a month</span>
        </div>
        <Included trainer={t?.name} />
        <div className="mt-6 [&_button]:w-full"><MembershipButtons action="add" label="Add a card" /></div>
        <CardNote />
      </div>
      <Link href="/me" className="mt-6 inline-block text-body font-semibold text-on-surface-variant underline underline-offset-4">Your account</Link>
    </div>
  );
}
