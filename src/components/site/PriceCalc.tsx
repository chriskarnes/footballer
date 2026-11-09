'use client';
import { useState } from 'react';

/**
 * What a trainer pays, worked out for their own numbers. The rule is $5 a
 * player a month, plus 10% of whatever they charge above $5. Charging $5 or
 * less (or nothing, and paying it themselves) is just the $5.
 */
export const feeFor = (price: number) => 5 + Math.max(0, price - 5) * 0.1;

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function PriceCalc() {
  const [players, setPlayers] = useState(15);
  const [price, setPrice] = useState(40);
  const fee = feeFor(price);
  const keep = Math.max(0, price - fee);

  return (
    <div className="card p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-field">
          <span>Players</span>
          <input type="number" inputMode="numeric" min={1} max={500} value={players}
                 onChange={(e) => setPlayers(Math.max(0, Math.min(500, Number(e.target.value) || 0)))} />
        </label>
        <label className="text-field">
          <span>You charge each player, per month</span>
          <input type="number" inputMode="decimal" min={0} max={1000} value={price}
                 onChange={(e) => setPrice(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))} />
        </label>
      </div>

      <dl className="mt-6 divide-y divide-outline-variant border-t border-outline-variant text-[15px]">
        <Row label="Our fee, per player" note={price > 5 ? `$5 + 10% of ${money(price - 5)}` : undefined}>{money(fee)}</Row>
        <Row label="You keep, per player">{money(keep)}</Row>
        <Row label={`Our fee for ${players} ${players === 1 ? 'player' : 'players'}, per month`} strong>{money(fee * players)}</Row>
      </dl>
    </div>
  );
}

function Row({ label, note, children, strong }: { label: string; note?: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <dt className="text-on-surface-variant">
        {label}
        {note && <span className="mt-0.5 block text-[13px]">{note}</span>}
      </dt>
      <dd className={`text-right text-on-surface ${strong ? 'text-[18px] font-extrabold' : 'font-bold'}`}>{children}</dd>
    </div>
  );
}
