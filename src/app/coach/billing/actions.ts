'use server';
import { headers } from 'next/headers';
import { getViewer } from '@/lib/viewer';
import { plain } from '@/lib/plain-error';
import { isLive, trialEndFor } from '@/lib/billing';
import { billingDb, ensurePrice, playerCount, readBilling, stripe } from '@/lib/billing-server';
import { readTerms } from '@/lib/membership-server';

type Go = { ok: true; url: string } | { ok: false; error: string };

const NOT_ON = 'Billing isn’t switched on yet.';
const FAILED = 'Couldn’t reach the payment page. Try again in a minute.';

/**
 * Billing is the owner's alone: they pay. The academy is the one this request
 * came in on, never an id from the browser, and both actions only hand back
 * an address on Stripe's own pages, where the card is typed.
 */
async function owner() {
  const v = await getViewer();
  if (!v.academy || !v.user || v.role !== 'owner') return null;
  const s = stripe(), db = billingDb();
  if (!s || !db) return { off: true as const };
  const h = await headers();
  const here = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  return { off: false as const, s, db, academy: v.academy, user: v.user, back: `${here}/coach/billing` };
}

/** To Stripe's checkout, to add a card and start paying for the players there now. */
export async function startCheckout(): Promise<Go> {
  const o = await owner();
  if (!o) return { ok: false, error: 'Only the academy’s owner can set up billing.' };
  if (o.off) return { ok: false, error: NOT_ON };
  try {
    if ((await readTerms(o.db, o.academy.id))?.mode === 'players_pay') return { ok: false, error: 'Your players’ families pay here, so there’s nothing for you to pay.' };
    const row = await readBilling(o.db, o.academy.id);
    // Already paying: the card is changed on Stripe's own page, not by starting again.
    if (row?.stripe_subscription_id && isLive(row.status)) return openPortal();

    const players = await playerCount(o.db, o.academy.id);
    if (!players) return { ok: false, error: 'You have no players yet, so there’s nothing to pay for. Add a card once your first player joins.' };

    let customer = row?.stripe_customer_id ?? null;
    if (!customer) {
      const made = await o.s.customers.create({
        email: o.user.email ?? undefined, name: o.academy.name,
        metadata: { academy_id: o.academy.id, slug: o.academy.slug },
      });
      customer = made.id;
      const { error } = await o.db.from('academy_billing')
        .upsert({ academy_id: o.academy.id, stripe_customer_id: customer, updated_at: new Date().toISOString() }, { onConflict: 'academy_id' });
      if (error) throw error;
    }

    const trialEnd = trialEndFor(row?.free_until, Date.now());
    const session = await o.s.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: o.academy.id,
      line_items: [{ price: await ensurePrice(o.s), quantity: players }],
      subscription_data: { metadata: { academy_id: o.academy.id }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
      success_url: `${o.back}?done=1`,
      cancel_url: o.back,
    });
    if (!session.url) throw new Error('checkout session has no url');
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: plain(e, FAILED) };
  }
}

/** To Stripe's own page for the card, the invoices and cancelling. */
export async function openPortal(): Promise<Go> {
  const o = await owner();
  if (!o) return { ok: false, error: 'Only the academy’s owner can manage billing.' };
  if (o.off) return { ok: false, error: NOT_ON };
  try {
    const row = await readBilling(o.db, o.academy.id);
    if (!row?.stripe_customer_id) return { ok: false, error: 'Add a card first.' };
    const session = await o.s.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: o.back });
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: plain(e, FAILED) };
  }
}
