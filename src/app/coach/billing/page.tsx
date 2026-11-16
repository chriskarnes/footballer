import { PageHead } from '@/components/coach/PageHead';
import { staffOnly } from '@/components/coach/Gate';
import { BillingButtons } from '@/components/coach/BillingButtons';
import { billingState, dollars, isLive, monthlyCents, PRICE_CENTS } from '@/lib/billing';
import { billingDb, billingOn, playerCount, readBilling, stripe, syncSeats } from '@/lib/billing-server';
import { CONTACT_EMAIL } from '@/lib/legal';
import { readTerms, rosterMarks } from '@/lib/membership-server';
import { accessLabel, playerAccess } from '@/lib/membership';
import Link from 'next/link';
import { nameOf } from '@/lib/coach-data';

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

  // Families pay here (0038): the owner pays nothing, and sees who is paying.
  const terms = await readTerms(db, academy.id);
  if (terms?.mode === 'none') {
    return (
      <div className="animate-pop">
        <PageHead title="Billing" back={back}>There&rsquo;s nothing to pay for {academy.name}, for you or your players&rsquo; families.</PageHead>
      </div>
    );
  }
  if (terms?.mode === 'players_pay') {
    const [{ data: roster }, paid] = await Promise.all([
      db.rpc('academy_players', { p_academy: academy.id, p_since: new Date().toISOString(), p_player: null }),
      rosterMarks(db, academy.id),
    ]);
    const list = ((roster ?? []) as { user_id: string; joined_at: string; email: string | null; display_name: string | null }[])
      .map((r) => ({ id: r.user_id, name: nameOf(r), access: paid.marks.get(r.user_id)?.access ?? playerAccess(terms, r.joined_at, null, Date.now()) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const count = (s: string) => list.filter((p) => p.access.state === s).length;
    const paying = count('paid') + count('past_due');
    return (
      <div className="animate-pop">
        <PageHead title="Billing" back={back} />
        <section className="card mt-8 p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-brand text-[44px] font-extrabold leading-none text-on-surface">{dollars(terms.priceCents)}</span>
            <span className="text-body font-semibold text-on-surface-variant">a month, paid by each player&rsquo;s family</span>
          </div>
          <p className="mt-4 text-body-lg font-semibold text-on-surface">You pay nothing.</p>
          <p className="mt-1 text-body leading-relaxed text-on-surface-variant">
            Each player trains free for {terms.trialDays} days, then their family adds a card to keep going. A player whose
            free days are over and who hasn&rsquo;t paid can&rsquo;t open their sessions until they do.
          </p>
        </section>
        <section className="mt-8">
          <p className="eyebrow mb-3">{paying} paying · {count('trial')} in free days · {count('locked')} not paying{count('paused') ? ` · ${count('paused')} inactive` : ''}</p>
          {!list.length ? <p className="text-body text-on-surface-variant">No players yet.</p> : (
            <ul className="card divide-y divide-outline-variant">
              {list.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <Link href={`/coach/players/${p.id}`} className="min-w-0 truncate text-body font-semibold text-on-surface underline-offset-4 hover:underline">{p.name}</Link>
                  <span className={`shrink-0 text-body-sm font-semibold ${p.access.state === 'locked' || p.access.state === 'past_due' ? 'text-on-surface' : 'text-on-surface-variant'}`}>{accessLabel(p.access)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
          {players} active {players === 1 ? 'player' : 'players'} · {dollars(monthlyCents(players))} a month
        </p>
        <p className="mt-1 text-body leading-relaxed text-on-surface-variant">
          Trainers aren&rsquo;t counted. Make a player inactive, or remove them, and you stop paying for them from your next payment.
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
