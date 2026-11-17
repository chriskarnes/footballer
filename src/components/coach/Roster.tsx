'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Progress, Status } from '@/lib/progress';
import { Avatar } from '@/components/Avatar';
import { WeekDots } from './WeekDots';
import { StatusTag } from './StatusTag';
import { NoteButton } from './NoteDialog';

export type RosterRow = {
  id: string; name: string; groups: string[];
  status: Status; reason: string; detail: string | null;
  /** "today", "3 days ago", "never". */
  since: string; daysSince: number | null;
  week: Progress['week'];
  /** Where payment stands, or that they're switched off: null with nothing to say. */
  pay: { label: string; active: boolean; attention: boolean } | null;
};

type Filter = 'all' | 'nudge' | 'unpaid' | 'inactive';
type Sort = 'attention' | 'name' | 'last';

const active = (r: RosterRow) => r.pay?.active !== false;
const FILTERS: { id: Filter; label: string; keep: (r: RosterRow) => boolean }[] = [
  { id: 'all', label: 'All', keep: () => true },
  { id: 'nudge', label: 'Need a nudge', keep: (r) => active(r) && r.status !== 'good' },
  { id: 'unpaid', label: 'Not paying', keep: (r) => !!r.pay?.attention },
  { id: 'inactive', label: 'Inactive', keep: (r) => !active(r) },
];

/**
 * The trainer's players, findable: a search box, a few filters and a sort,
 * for a list of thirty to sixty. It arrives worst first, which is still the
 * order unless another is picked. Cards on a phone, a table on a laptop.
 */
export function Roster({ rows, showGroups }: { rows: RosterRow[]; showGroups: boolean }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('attention');

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, rows.filter(f.keep).length])) as Record<Filter, number>, [rows]);
  const shown = useMemo(() => {
    const word = q.trim().toLowerCase();
    const keep = FILTERS.find((f) => f.id === filter)!.keep;
    const out = rows.filter((r) => keep(r) && (!word || r.name.toLowerCase().includes(word) || r.groups.some((g) => g.toLowerCase().includes(word))));
    if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
    // Longest quiet first; never trained before anyone.
    if (sort === 'last') out.sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity));
    return out;
  }, [rows, q, filter, sort]);

  // With a handful of players there's nothing to find.
  const tools = rows.length > 6;
  const chips = FILTERS.filter((f) => f.id === 'all' || counts[f.id] > 0);

  return (
    <div className="mt-6">
      {tools && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <label className="relative block min-w-0 flex-1 basis-56 lg:max-w-xs">
            <span className="sr-only">Search players by name or group</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-on-surface-variant" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players"
                   className="min-h-11 w-full rounded-full border border-outline bg-surface-container-lowest pl-11 pr-4 text-[16px] text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary" />
          </label>
          <label className="flex items-center gap-2 text-body-sm font-semibold text-on-surface-variant">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                    className="min-h-11 rounded-full border border-outline bg-surface-container-lowest px-4 text-body font-semibold text-on-surface">
              <option value="attention">Needs attention first</option>
              <option value="name">Name</option>
              <option value="last">Longest since training</option>
            </select>
          </label>
        </div>
      )}
      {chips.length > 1 && (
        <div className={`flex flex-wrap gap-2 ${tools ? 'mt-3' : ''}`} role="group" aria-label="Show">
          {chips.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                    className={`chip ${filter === f.id ? 'chip-on' : ''}`}>
              {f.label} <span className="tabular-nums opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      )}

      {!shown.length && <p role="status" className="mt-6 text-body text-on-surface-variant">No one matches.</p>}

      {/* Phone: cards. */}
      <ul className="mt-5 space-y-2.5 lg:hidden">
        {shown.map((p) => (
          <li key={p.id} className={`card flex items-center gap-3 py-4 pl-4 pr-3 ${active(p) ? '' : 'opacity-75'}`}>
            <Link href={`/coach/players/${p.id}`} className="flex min-w-0 flex-1 items-start gap-3">
              <Avatar name={p.name} className="h-10 w-10 text-body-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-lg font-bold text-on-surface">{p.name}</span>
                {showGroups && !!p.groups.length && (
                  <span className="block truncate text-caption font-semibold text-on-surface-variant">{p.groups.join(' · ')}</span>
                )}
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusTag status={p.status}>{p.reason}</StatusTag>
                  <PayTag pay={p.pay} />
                </span>
                {p.detail && <span className="mt-1 block truncate text-body-sm text-on-surface-variant">{p.detail}</span>}
                <span className="mt-3 block"><WeekDots week={p.week} /></span>
              </span>
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
                <tr key={p.id} className={`group relative cursor-pointer hover:bg-surface-container-low ${active(p) ? '' : 'opacity-75'}`}>
                  <td className="px-3 py-4">
                    <span className="flex items-center gap-3">
                      <Avatar name={p.name} className="h-9 w-9 text-body" />
                      <span className="min-w-0">
                        <Link href={`/coach/players/${p.id}`} className="font-bold text-on-surface underline-offset-4 after:absolute after:inset-0 group-hover:underline">{p.name}</Link>
                        {p.pay?.label && <span className="mt-0.5 block"><PayTag pay={p.pay} /></span>}
                      </span>
                    </span>
                  </td>
                  {showGroups && <td className="max-w-[14rem] truncate px-3 py-4 text-on-surface-variant">{p.groups.join(', ') || '—'}</td>}
                  <td className="px-3 py-4"><WeekDots week={p.week} /></td>
                  <td className="px-3 py-4 text-on-surface-variant">
                    <StatusTag status={p.status}>{p.reason}</StatusTag>
                    {p.detail && <span className="mt-1 block text-body-sm">{p.detail}</span>}
                  </td>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-3 pb-3 font-semibold">{children}</th>;
}

/** Where a player's payment stands, or that they're switched off (the one in rose). */
function PayTag({ pay }: { pay: RosterRow['pay'] }) {
  if (!pay?.label) return null;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-caption font-semibold
      ${!pay.active ? 'border-[#E8A0B4] bg-[#FCE4EC] text-[#9B1C45] dark:border-[#8E3A55] dark:bg-[#4A1F2D] dark:text-[#FFC2D4]'
        : pay.attention ? 'border-on-surface text-on-surface' : 'border-outline-variant text-on-surface-variant'}`}>{pay.label}</span>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         className="size-4.5" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
  );
}
