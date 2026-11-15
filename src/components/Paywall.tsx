'use client';
import Link from 'next/link';
import { MembershipButtons } from './MembershipButtons';

/**
 * What a player sees in place of their training once their free days are
 * over and there's no card (0038). Says what it costs and whose training it
 * is, and goes straight to the card. Me stays open, to sign out or leave.
 */
export function Paywall({ lock }: { lock: { academy: string; price: string; line: string } }) {
  return (
    <div className="animate-pop pt-10">
      <p className="eyebrow mb-3">{lock.academy}</p>
      <h1 className="h-page">Keep training</h1>
      <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">{lock.line}</p>
      <div className="card mt-6 p-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-brand text-[44px] font-extrabold leading-none text-on-surface">{lock.price}</span>
          <span className="text-body font-semibold text-on-surface-variant">a month</span>
        </div>
        <ul className="mt-4 space-y-1.5 text-body leading-relaxed text-on-surface-variant">
          <li>The sessions your trainer sets each week, with the videos.</li>
          <li>Your trainer sees what you finish.</li>
          <li>Cancel any time.</li>
        </ul>
        <div className="mt-5"><MembershipButtons action="add" label="Add a card" /></div>
        <p className="mt-4 text-body-sm leading-relaxed text-on-surface-variant">
          A parent or guardian should do this. Cards are handled by Stripe; we never see the card number.
        </p>
      </div>
      <Link href="/me" className="mt-6 inline-block text-body font-semibold text-on-surface-variant underline underline-offset-4">Your account</Link>
    </div>
  );
}
