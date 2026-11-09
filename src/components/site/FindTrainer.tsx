'use client';
import { useEffect, useState } from 'react';
import { findAcademies, type Found } from '@/app/site/actions';
import { academyOrigin, ROOT_DOMAIN } from '@/lib/tenant';

/**
 * Type a trainer's name, their academy or your town; pick them; ask to join
 * on their own address. Searches as you type, after a short pause.
 */
export function FindTrainer() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [here, setHere] = useState('https://train.futbol');
  useEffect(() => setHere(window.location.href), []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      setResults(await findAcademies(q));
      setBusy(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <label className="text-field">
        <span>Your trainer&rsquo;s name, their business, or your town</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
               placeholder="e.g. Riverside, or Mike Evans" />
      </label>

      <div aria-live="polite" className="mt-4">
        {results && results.length > 0 && (
          <ul className="card divide-y divide-outline-variant">
            {results.map((r) => (
              <li key={r.slug}>
                <a href={`${academyOrigin(r.slug, here)}/request`}
                   className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold text-on-surface">{r.name}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-on-surface-variant">
                      {[r.city, `${r.slug}.${ROOT_DOMAIN}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="btn-ghost btn-sm shrink-0">Ask to join</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {results && results.length === 0 && !busy && (
          <p className="card-flat px-5 py-4 text-[14.5px] leading-relaxed text-on-surface-variant">
            No trainer by that name yet. Check the spelling, or ask your trainer for their link.
          </p>
        )}
      </div>
    </div>
  );
}
