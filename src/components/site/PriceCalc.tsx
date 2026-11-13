'use client';
import { useState } from 'react';

/**
 * Pricing. The price is the headline: $5 a player a month. Everything else is
 * secondary and sits below it in ordinary type, so no large number can be
 * mistaken for what we charge.
 *
 *   1. They collect from their players themselves: a flat $5 a player a month.
 *   2. Players pay through Train.futbol: $5 of each player's payment plus 10%
 *      of anything above $5, and the rest is the trainer's.
 *
 * The calculator works both out for the trainer's own numbers.
 */
export const feeFor = (price: number) => 5 + Math.max(0, price - 5) * 0.1;
const FLAT = 5;

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

const clamp = (v: string, max: number) => Math.max(0, Math.min(max, Number(v) || 0));

export function PriceCalc() {
  const [players, setPlayers] = useState(15);
  const [price, setPrice] = useState(40);
  const fee = feeFor(price);
  const keep = Math.max(0, price - fee);
  const covers = price > FLAT;
  const count = `${players} ${players === 1 ? 'player' : 'players'}`;

  return (
    <div className="space-y-4">
      {/* The price, and the two ways to pay it. */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-6 sm:p-8">
          <span className="font-brand text-[56px] font-extrabold leading-none tracking-brand-snug text-site-ink sm:text-[72px]">$5</span>
          <span className="text-[16px] font-semibold text-on-surface-variant">per player, per month</span>
        </div>
        <dl className="grid border-t border-outline-variant sm:grid-cols-2 sm:divide-x sm:divide-outline-variant">
          <Plan title="You collect from players yourself" price="$5 per player">
            That&rsquo;s all we charge. Charge your players however you do now, or don&rsquo;t charge them.
          </Plan>
          <Plan title="Players pay through Train.futbol" price="$5 + 10% above $5" className="border-t border-outline-variant sm:border-t-0">
            You set a monthly price. We keep $5 of each payment, plus 10% of anything above $5. You never get a bill.
          </Plan>
        </dl>
      </div>

      {/* Secondary: the same two plans, for their own numbers. */}
      <div className="card-flat p-6 sm:p-7">
        <p className="eyebrow">Work out your numbers</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <label className="text-field">
            <span>Players</span>
            <input type="number" inputMode="numeric" min={1} max={500} value={players}
                   onChange={(e) => setPlayers(clamp(e.target.value, 500))} />
          </label>
          <label className="text-field">
            <span>You charge each player, per month ($)</span>
            <input type="number" inputMode="decimal" min={0} max={1000} value={price}
                   onChange={(e) => setPrice(clamp(e.target.value, 1000))} />
          </label>
        </div>

        <dl className="mt-6 divide-y divide-outline-variant border-y border-outline-variant text-[14.5px]">
          <Row label="If you collect yourself, we charge" note={`$5 × ${count}`}>{money(FLAT * players)} a month</Row>
          {covers ? (
            <>
              <Row label="If players pay through Train.futbol, we keep" note={`${money(fee)} × ${count}`}>{money(fee * players)} a month</Row>
              <Row label="And you keep" note={`${money(keep)} × ${count}`}>{money(keep * players)} a month</Row>
            </>
          ) : (
            <div className="py-3 leading-relaxed text-on-surface-variant">
              At {money(price)} or less, there&rsquo;s nothing left after our $5. If you want to charge that little, or nothing,
              collect from your players yourself.
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

function Plan({ title, price, className = '', children }: { title: string; price: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`p-6 sm:p-7 ${className}`}>
      <dt className="text-[13.5px] font-semibold text-on-surface-variant">{title}</dt>
      <dd className="mt-1 font-brand text-[20px] font-extrabold tracking-tight text-site-ink">{price}</dd>
      <dd className="mt-2 text-[14.5px] leading-relaxed text-on-surface-variant">{children}</dd>
    </div>
  );
}

function Row({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-3">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-right">
        <span className="font-bold text-on-surface">{children}</span>
        <span className="ml-2 text-[12.5px] text-on-surface-variant">{note}</span>
      </dd>
    </div>
  );
}
