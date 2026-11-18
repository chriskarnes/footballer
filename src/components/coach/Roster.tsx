'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Progress, Status } from '@/lib/progress';
import { WeekDots } from './WeekDots';
import { StatusTag } from './StatusTag';
import { NoteButton } from './NoteDialog';

export type RosterRow = {
  id: string; name: string; groups: string[];
  status: Status; reason: string; detail: string | null;
  /** "today", "3 days ago", "never". */
  since: string; daysSince: number | null;
  week: Progress['week'];
  /** Where payment stands, or that they're switched off: null with nothing to say.
   *  Shown only when it's the trainer's to act on (`attention`) or they're off. */
  pay: { label: string; active: boolean; attention: boolean } | null;
};

const active = (r: RosterRow) => r.pay?.active !== false;

/**
 * The trainer's players: worst first, switched-off players last. A search box
 * above it, and only once the list is long enough to need finding in. Colour is kept for what needs a look: a
 * player on track is plain text. Cards on a phone, a table on a laptop.
 * The week's dots are in the table only: on a card they were seven circles
 * with no day letters, and the words beside them already say it.
 */
export function Roster({ rows, showGroups }: { rows: RosterRow[]; showGroups: boolean }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const word = q.trim().toLowerCase();
    const out = rows.filter((r) => (!word || r.name.toLowerCase().includes(word) || r.groups.some((g) => g.toLowerCase().includes(word))));
    // Switched off: still on the list, at the end of it.
    return [...out.filter(active), ...out.filter((r) => !active(r))];
  }, [rows, q]);

  // With a handful of players there's nothing to find.
  const search = rows.length > 8;

  return (
    <div className="mt-6">
      {search && (
        <div className="flex flex-wrap items-center gap-3">
            <label className="relative block min-w-0 flex-1 basis-56 lg:max-w-xs">
              <span className="sr-only">Search players by name or group</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-on-surface-variant" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players"
                     className="min-h-11 w-full rounded-full border border-outline-variant bg-surface-container-lowest pl-11 pr-4 text-[16px] text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary" />
            </label>
        </div>
      )}

      {!shown.length && <p role="status" className="mt-6 text-body text-on-surface-variant">No one matches.</p>}

      {/* Phone: cards. */}
      <ul className="mt-5 space-y-2.5 lg:hidden">
        {shown.map((p) => (
          <li key={p.id} className={`card flex items-center gap-3 py-4 pl-4 pr-3 ${active(p) ? '' : 'opacity-60'}`}>
            <Link href={`/coach/players/${p.id}`} className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-body-lg font-bold text-on-surface">{p.name}</span>
                <PayTag pay={p.pay} />
              </span>
              {showGroups && !!p.groups.length && (
                <span className="block truncate text-caption font-semibold text-on-surface-variant">{p.groups.join(' · ')}</span>
              )}
              {active(p) && <span className="mt-1.5 block text-body text-on-surface-variant"><Standing p={p} stacked /></span>}
            </Link>
            {active(p) && p.status !== 'good' && (
              <NoteButton to={p.id} kind="nudge" className="btn-ghost btn-sm pressable shrink-0">Nudge</NoteButton>
            )}
            <Link href={`/coach/players/${p.id}`} aria-label={`Open ${p.name}`} className="pressable -mr-1 flex size-9 shrink-0 items-center justify-center text-on-surface-variant">
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>

      {/* Laptop: a table, in the open. */}
      {!!shown.length && (
        <div className="mt-5 hidden lg:block">
          <table className="w-full text-left text-body">
            <thead className="eyebrow border-b border-outline-variant">
              <tr><Th>Player</Th>{showGroups && <Th>Groups</Th>}<Th>This week</Th><Th>Status</Th><Th>Last trained</Th><Th><span className="sr-only">Actions</span></Th></tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {shown.map((p) => (
                <tr key={p.id} className={`group relative cursor-pointer hover:bg-surface-container-low ${active(p) ? '' : 'opacity-60'}`}>
                  <td className="px-3 py-4">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/coach/players/${p.id}`} className="font-bold text-on-surface underline-offset-4 after:absolute after:inset-0 group-hover:underline">{p.name}</Link>
                      <PayTag pay={p.pay} />
                    </span>
                  </td>
                  {showGroups && <td className="max-w-[14rem] truncate px-3 py-4 text-on-surface-variant">{p.groups.join(', ') || '—'}</td>}
                  <td className="px-3 py-4">{active(p) && <WeekDots week={p.week} />}</td>
                  <td className="px-3 py-4 text-on-surface-variant">{active(p) ? <Standing p={p} /> : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-on-surface-variant">{p.since}</td>
                  <td className="px-3 py-4 text-right">
                    <span className="flex items-center justify-end gap-3">
                      {active(p) && p.status !== 'good' && (
                        <span className="relative z-10"><NoteButton to={p.id} kind="nudge" className="btn-ghost btn-sm pressable">Nudge</NoteButton></span>
                      )}
                      <span className="text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-on-surface"><Chevron /></span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Where their week stands: a coloured tag only when it needs a look, plain
 * words when it doesn't. `stacked`, on a phone card, puts the count on its
 * own line: beside the tag it wrapped mid-phrase.
 */
function Standing({ p, stacked }: { p: RosterRow; stacked?: boolean }) {
  return (
    <>
      {p.status === 'good'
        ? <span className="font-semibold text-on-surface">{p.reason}</span>
        : <StatusTag status={p.status}>{p.reason}</StatusTag>}
      {p.detail && (stacked
        ? <span className="mt-1 block text-body-sm">{p.detail}</span>
        : <span className="text-body-sm"> · {p.detail}</span>)}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-3 pb-3 font-semibold">{children}</th>;
}

/**
 * A player's payment, only when it wants a look (not paid, a failed payment,
 * not paying), or that they're switched off (the one in rose). Paid and
 * paying say nothing: a tag on every row is a tag nobody reads.
 */
function PayTag({ pay }: { pay: RosterRow['pay'] }) {
  if (!pay?.label || (pay.active && !pay.attention)) return null;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-caption font-semibold
      ${!pay.active ? 'border-[#E8A0B4] bg-[#FCE4EC] text-[#9B1C45] dark:border-[#8E3A55] dark:bg-[#4A1F2D] dark:text-[#FFC2D4]'
        : 'border-on-surface text-on-surface'}`}>{pay.label}</span>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         className="size-4.5" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
  );
}
