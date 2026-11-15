import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { billingDb, saveSubscription, stripe, syncSeats } from '@/lib/billing-server';

export const runtime = 'nodejs';

/**
 * Stripe's messages about trainer billing. Each is checked against the
 * signing secret before anything is believed, and none is trusted for its
 * contents: the subscription is read back from Stripe by id.
 *
 * A failure answers 500, and Stripe sends the message again later.
 */
export async function POST(req: Request) {
  const s = stripe();
  const db = billingDb();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !db || !secret) return NextResponse.json({ error: 'billing is not set up' }, { status: 503 });

  // The exact bytes Stripe sent: the signature is over them.
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, req.headers.get('stripe-signature') ?? '', secret);
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const id = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (session.mode !== 'subscription' || !id) break;
        const academyId = await saveSubscription(s, db, id, session.client_reference_id);
        // Players may have joined while the card was being typed in.
        await syncSeats(s, db, academyId);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await saveSubscription(s, db, event.data.object.id);
        break;
      case 'invoice.upcoming': {
        // A few days before each payment: charge for the players there now.
        const c = event.data.object.customer;
        const customer = typeof c === 'string' ? c : c?.id;
        if (!customer) break;
        const { data } = await db.from('academy_billing').select('academy_id').eq('stripe_customer_id', customer).maybeSingle();
        if (data?.academy_id) await syncSeats(s, db, data.academy_id as string);
        break;
      }
    }
  } catch (e) {
    console.error('stripe webhook', event.type, e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
