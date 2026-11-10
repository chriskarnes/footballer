'use client';
import { useState } from 'react';

/**
 * Pricing, worked out for the trainer's own numbers. Two plans, kept apart so
 * they don't blur together:
 *
 *   1. Players pay through Train.futbol (the lead). The trainer sets a monthly
 *      price; we keep $5 of each player's payment plus 10% of anything above
 *      $5, and the rest is theirs. The calculator leads with what they make.
 *   2. They pay us directly: a flat $5 a player a month, and they charge their
 *      players however they already do. Shown second, on its own.
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
  const share = covers ? Math.round((keep / price) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Plan 1: players pay through us. */}
      <div className="card overflow-hidden">
        <div className="p-6 sm:p-8">
          <p className="eyebrow">Your players pay through Train.futbol</p>
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

          {covers ? (
            <>
              <div className="mt-7">
                <p className="text-[14px] font-semibold text-on-surface-variant">You make, every month</p>
                <p className="font-brand text-[44px] font-extrabold leading-none tracking-tighter text-site-ink sm:text-[56px]">
                  {money(keep * players)}
                </p>
                <p className="mt-2 text-[14px] text-on-surface-variant">
                  {money(keep)} from each player. That&rsquo;s {share}% of what they pay.
                </p>
              </div>

              {/* One player's payment, split. */}
              <div className="mt-6">
                <div className="flex h-3 overflow-hidden rounded-full bg-site-mint" aria-hidden>
                  <div className="bg-site-pitch" style={{ width: `${share}%` }} />
                  <div className="bg-site-lime" style={{ width: `${100 - share}%` }} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-3 text-[13px]">
                  <Part label="A player pays">{money(price)}</Part>
                  <Part label="You keep" dot="bg-site-pitch">{money(keep)}</Part>
                  <Part label="Our cut" dot="bg-site-lime" note={`$5 + 10% of ${money(price - FLAT)}`}>{money(fee)}</Part>
                </dl>
              </div>
            </>
          ) : (
            <p className="mt-6 rounded-xl bg-site-paper px-4 py-3 text-[14px] leading-relaxed text-on-surface-variant">
              At {money(price)} or less there&rsquo;s nothing left after our $5. If you&rsquo;d rather keep it that cheap or free,
              the plan below is the one for you.
            </p>
          )}
        </div>
        {covers && (
          <p className="border-t border-outline-variant bg-site-paper px-6 py-3.5 text-[13.5px] text-on-surface-variant sm:px-8">
            Our cut for {players} {players === 1 ? 'player' : 'players'}: <b className="font-semibold text-on-surface">{money(fee * players)}</b> a month,
            taken from their payments. You never get a bill.
          </p>
        )}
      </div>

      {/* Plan 2: they pay us directly. */}
      <div className="card-flat p-6 sm:p-7">
        <p className="eyebrow">Or pay us directly</p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="min-w-0 flex-1 basis-[18rem] text-[14.5px] leading-relaxed text-on-surface-variant">
            Already charge your players your own way, or want it free for them? Pay us a flat <b className="font-semibold text-on-surface">$5 a player, a month</b> and
            nothing goes through us.
          </p>
          <p className="sm:text-right">
            <span className="block font-brand text-[24px] font-extrabold tracking-tight text-site-ink">{money(FLAT * players)}</span>
            <span className="text-[12.5px] text-on-surface-variant">a month for {players} {players === 1 ? 'player' : 'players'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Part({ label, dot, note, children }: { label: string; dot?: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-on-surface-variant">
        {dot && <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />}{label}
      </dt>
      <dd className="mt-0.5 text-[16px] font-bold text-on-surface">{children}</dd>
      {note && <dd className="text-[12px] text-on-surface-variant">{note}</dd>}
    </div>
  );
}
