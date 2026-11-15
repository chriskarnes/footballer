import { PageHead } from '@/components/coach/PageHead';
import { staffOnly } from '@/components/coach/Gate';
import { BillingButtons } from '@/components/coach/BillingButtons';
import { billingState, dollars, isLive, monthlyCents, PRICE_CENTS } from '@/lib/billing';
import { billingDb, billingOn, playerCount, readBilling, stripe, syncSeats } from '@/lib/billing-server';
import { CONTACT_EMAIL } from '@/lib/legal';

export const metadata = { title: 'Billing', robots: { index: false } };

/**
 * What the academy pays, and where that stands. The owner's page: they pay.
 * The card itself is never here; adding or changing it happens on Stripe's
 * own pages, and this shows what Stripe last told us.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const gate = await staffOnly('/coach/billing');
  if ('page' in gate) return gate.page;
  const { db, academy, role } = gate.viewer;
  const { done } = await searchParams;
  const back = { href: '/coach/team', label: 'Academy' };

  if (role !== 'owner') {
    return (
      <div className="animate-pop">
        <PageHead title="Billing" back={back}>Only {academy.name}&rsquo;s owner sees billing.</PageHead>
      </div>
    );
  }

  let players = 0;
  let row = null as Awaited<ReturnType<typeof readBilling>>;
  let ready = billingOn();
  try {
    [players, row] = await Promise.all([playerCount(db, academy.id), ready ? readBilling(db, academy.id) : null]);
    // Players have joined or left since Stripe was last told: tell it now.
    const s = stripe(), admin = billingDb();
    if (s && admin && row?.stripe_subscription_id && isLive(row.status) && row.quantity !== players) {
      await syncSeats(s, admin, academy.id);
      row = await readBilling(db, academy.id);
    }
  } catch (e) {
    // Before migration 0037 there's no table to read.
    console.error('billing page', e);
    ready = false;
  }
  const state = billingState(row, players, Date.now());

  return (
    <div className="animate-pop">
      <PageHead title="Billing" back={back} />

      <section className="card mt-8 p-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-brand text-[44px] font-extrabold leading-none text-on-surface">{dollars(PRICE_CENTS)}</span>
          <span className="text-body font-semibold text-on-surface-variant">per player, per month</span>
        </div>
        <p className="mt-4 text-body-lg font-semibold text-on-surface">
          {players} {players === 1 ? 'player' : 'players'} · {dollars(monthlyCents(players))} a month
        </p>
        <p className="mt-1 text-body leading-relaxed text-on-surface-variant">
          Trainers aren&rsquo;t counted. Remove a player and you stop paying for them from your next payment.
        </p>
      </section>

      <section className="card mt-4 p-6">
        {!ready ? (
          <p className="text-body leading-relaxed text-on-surface-variant">
            Paying by card isn&rsquo;t switched on yet. There&rsquo;s nothing to do for now.
          </p>
        ) : (
          <>
            {done && !row?.stripe_subscription_id && (
              <p className="mb-3 text-body font-semibold text-on-surface">Card saved. It can take a minute to show here.</p>
            )}
            <p role={state.warn ? 'alert' : undefined}
               className={`text-body leading-relaxed ${state.warn ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>
              {state.line}
            </p>
            <BillingButtons action={state.action} hasCustomer={!!row?.stripe_customer_id} />
            <p className="mt-4 text-body-sm leading-relaxed text-on-surface-variant">
              Cards are handled by Stripe. We never see or store your card number.
            </p>
          </>
        )}
      </section>

      {CONTACT_EMAIL && (
        <p className="mt-6 text-body-sm text-on-surface-variant">
          A question about a payment? Write to <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-on-surface underline underline-offset-4">{CONTACT_EMAIL}</a>.
        </p>
      )}
    </div>
  );
}
