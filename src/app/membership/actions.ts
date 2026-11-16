'use server';
import { headers } from 'next/headers';
import { getViewer } from '@/lib/viewer';
import { plain } from '@/lib/plain-error';
import { isLive } from '@/lib/billing';
import { freeUntil, subscriptionTrialEnd } from '@/lib/membership';
import { readTerms } from '@/lib/membership-server';
import { billingDb, ensurePlayerPrice, readPlayerBilling, stripe } from '@/lib/billing-server';

type Go = { ok: true; url: string } | { ok: false; error: string };

const NOT_ON = 'Paying by card isn’t switched on yet.';
const FAILED = 'Couldn’t reach the payment page. Try again in a minute.';

/**
 * A family's membership (0038). The academy is the one this request came in
 * on and the player is whoever is signed in, never ids from the browser, and
 * both actions only hand back an address on Stripe's own pages.
 */
async function player() {
  const v = await getViewer();
  if (!v.academy || !v.user || v.role !== 'player') return null;
  const s = stripe(), db = billingDb();
  if (!s || !db) return { off: true as const };
  const h = await headers();
  const here = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  return { off: false as const, s, db, v, academy: v.academy, user: v.user, back: `${here}/membership` };
}

/** To Stripe's checkout, to add a card for this player's training here. */
export async function startMembership(): Promise<Go> {
  const p = await player();
  if (!p) return { ok: false, error: 'Sign in as a player here first.' };
  if (p.off) return { ok: false, error: NOT_ON };
  try {
    const terms = await readTerms(p.db, p.academy.id);
    if (!terms || terms.mode !== 'players_pay') return { ok: false, error: 'There’s nothing to pay here.' };
    const row = await readPlayerBilling(p.db, p.academy.id, p.user.id);
    // Already paying: the card is changed on Stripe's own page.
    if (row?.stripe_subscription_id && isLive(row.status) && row.status !== 'incomplete') return openMembershipPortal();

    // One Stripe customer per account, across academies.
    let customer = row?.stripe_customer_id ?? null;
    if (!customer) {
      const { data: other } = await p.db.from('player_billing').select('stripe_customer_id')
        .eq('user_id', p.user.id).not('stripe_customer_id', 'is', null).limit(1).maybeSingle();
      customer = (other?.stripe_customer_id as string | undefined) ?? null;
    }
    if (!customer) {
      // The account's email and nothing else: no player's name goes to Stripe.
      customer = (await p.s.customers.create({ email: p.user.email ?? undefined, metadata: { user_id: p.user.id } })).id;
    }
    const { error } = await p.db.from('player_billing')
      .upsert({ academy_id: p.academy.id, user_id: p.user.id, stripe_customer_id: customer, updated_at: new Date().toISOString() }, { onConflict: 'academy_id,user_id' });
    if (error) throw error;

    const { data: member } = await p.db.from('academy_members').select('*')
      .eq('academy_id', p.academy.id).eq('user_id', p.user.id).maybeSingle();
    // Switched off by their trainer (0040): nothing to pay until they're back on.
    if (member?.active === false) return { ok: false, error: 'Your trainer has paused your training here, so there’s nothing to pay.' };
    // A card added in the free days isn't charged until they end. Someone
    // coming back after cancelling has had theirs.
    const trialEnd = row?.stripe_subscription_id ? null : subscriptionTrialEnd(freeUntil(terms, member?.joined_at), Date.now());
    const session = await p.s.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: `${p.academy.id}:${p.user.id}`,
      line_items: [{ price: await ensurePlayerPrice(p.s, terms.priceCents), quantity: 1 }],
      subscription_data: {
        description: `Training plan with ${p.academy.name}`,
        metadata: { kind: 'player', academy_id: p.academy.id, user_id: p.user.id },
        ...(trialEnd ? { trial_end: trialEnd } : {}),
      },
      success_url: `${p.back}?done=1`,
      cancel_url: p.back,
    });
    if (!session.url) throw new Error('checkout session has no url');
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: plain(e, FAILED) };
  }
}

/** To Stripe's own page for the card, the receipts and cancelling. */
export async function openMembershipPortal(): Promise<Go> {
  const p = await player();
  if (!p) return { ok: false, error: 'Sign in as a player here first.' };
  if (p.off) return { ok: false, error: NOT_ON };
  try {
    const row = await readPlayerBilling(p.db, p.academy.id, p.user.id);
    if (!row?.stripe_customer_id) return { ok: false, error: 'Add a card first.' };
    const session = await p.s.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: p.back });
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: plain(e, FAILED) };
  }
}
