import Link from 'next/link';
import { BackLink } from '@/components/BackLink';
import { SignIn } from '@/components/SignIn';
import { MembershipButtons } from '@/components/MembershipButtons';
import { getViewer } from '@/lib/viewer';
import { dollars } from '@/lib/billing';
import { membershipLine } from '@/lib/membership';
import { myMembership } from '@/lib/membership-server';
import { billingOn } from '@/lib/billing-server';
import { CONTACT_EMAIL } from '@/lib/legal';
import { CardNote, Included } from '@/components/Paywall';
import { getTrainer } from '@/lib/player-week';
import { Tag } from '@/components/admin/ui';

export const metadata = { title: 'Membership', robots: { index: false } };

/**
 * A family's membership at this academy (0038): what it costs, where it
 * stands, and the way to Stripe to add a card, change it or cancel. The card
 * itself is never here.
 */
export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const v = await getViewer();
  const { done } = await searchParams;
  if (!v.user) {
    return (
      <div className="animate-pop pt-6">
        <h1 className="h-page">Membership</h1>
        <p className="mt-3 text-body text-on-surface-variant">Sign in to see it.</p>
        <div className="mt-5"><SignIn next="/membership" /></div>
      </div>
    );
  }
  const m = await myMembership();
  if (!m) {
    return (
      <div className="animate-pop pt-6">
        <BackLink href="/me" label="Me" />
        <h1 className="h-page">Membership</h1>
        <p className="mt-3 text-body leading-relaxed text-on-surface-variant">
          There&rsquo;s nothing to pay here{v.academy ? ` at ${v.academy.name}` : ''}.
        </p>
      </div>
    );
  }
  const { terms, access, row } = m;
  const paying = access.state === 'paid' || access.state === 'past_due';
  const trainer = await getTrainer().catch(() => null);
  const status = access.state === 'paid' ? { tone: 'good' as const, word: row?.cancel_at_period_end ? 'Ending' : 'Active' }
    : access.state === 'past_due' ? { tone: 'rose' as const, word: 'Payment failed' }
    : access.state === 'trial' ? { tone: 'wait' as const, word: `Free, ${access.daysLeft} ${access.daysLeft === 1 ? 'day' : 'days'} left` }
    : access.state === 'paused' ? { tone: 'plain' as const, word: 'Paused' }
    : access.state === 'locked' ? { tone: 'rose' as const, word: 'Not active' } : null;
  return (
    <div className="animate-pop pt-6">
      <BackLink href="/me" label="Me" />
      <p className="eyebrow mb-2">{m.academyName}</p>
      <h1 className="h-page">Membership</h1>

      <section className="card mt-6 p-6">
        {terms.mode === 'players_pay' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-brand text-[44px] font-extrabold leading-none text-on-surface">{dollars(terms.priceCents)}</span>
              <span className="text-body font-semibold text-on-surface-variant">a month</span>
            </div>
            {status && <Tag tone={status.tone}>{status.word}</Tag>}
          </div>
        )}
        {done && !paying && (
          <p className="mt-4 text-body font-semibold text-on-surface">Card saved. It can take a minute to show here.</p>
        )}
        <p role={access.state === 'past_due' ? 'alert' : undefined}
           className={`mt-4 text-body leading-relaxed ${access.state === 'past_due' || access.state === 'locked' ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>
          {membershipLine(terms, access, row)}
        </p>
        {terms.mode === 'players_pay' && !paying && access.state !== 'paused' && <Included trainer={trainer?.name} />}
        <div className="mt-6">
          {access.state === 'paused' ? null : billingOn()
            ? <MembershipButtons action={paying ? 'manage' : 'add'} hasCustomer={!!row?.stripe_customer_id && !paying} />
            : <p className="text-body text-on-surface-variant">Paying by card isn&rsquo;t switched on yet.</p>}
        </div>
        <CardNote> Cancel any time, and it runs to the end of the month you&rsquo;ve paid for.</CardNote>
      </section>

      {paying && <Link href="/" className="btn-ghost pressable mt-5 inline-flex">Back to training</Link>}
      {CONTACT_EMAIL && (
        <p className="mt-6 text-body-sm text-on-surface-variant">
          A question about a payment? Write to <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-on-surface underline underline-offset-4">{CONTACT_EMAIL}</a>.
        </p>
      )}
    </div>
  );
}
