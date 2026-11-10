'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addAddon, assignProgram, removeAddon, setMembership, unassignProgram } from '@/app/coach/content-actions';
import { suggestAddon } from '@/app/coach/suggest';
import { Chip } from '@/components/Chip';
import type { DrillRow, WeekItem } from '@/lib/academy-week';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Everything a trainer sets for one player, in the order it matters: the
 * week exactly as the player sees it; their groups (tap to change); programs
 * just for them; and "Just for you" drills, which Suggest can fill.
 */
export function PlayerTraining({ userId, first, week, groups, programs, own, addons, drills }: {
  userId: string; first: string; week: WeekItem[];
  groups: { id: string; name: string; member: boolean }[];
  programs: { id: string; name: string; weeks: number }[];
  own: { program_id: string; starts_on: string; label: string }[];
  addons: { id: string; name: string; note: string | null }[];
  drills: DrillRow[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [drill, setDrill] = useState('');
  const [note, setNote] = useState('');
  const [why, setWhy] = useState('');
  const [program, setProgram] = useState('');

  const run = (f: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    setErr('');
    const r = await f();
    if (!r.ok) setErr(r.error ?? 'That didn’t work.'); else { after?.(); router.refresh(); }
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="eyebrow mb-3">{first}&rsquo;s week</p>
        {week.length ? (
          <ul className="card divide-y divide-outline-variant">
            {week.map((it) => (
              <li key={it.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className={`block truncate text-[14.5px] font-semibold ${it.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{it.title}</span>
                  <span className="block truncate text-[12.5px] text-on-surface-variant">
                    {DAYS[it.weekday]}{it.practice && ' (practice day)'} · {it.kind === 'addon' ? 'Just for you' : it.kind === 'custom' ? 'Built week' : [it.groups.join(' & ') || 'On their own', it.from].join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-[12.5px] font-semibold text-on-surface-variant">{it.done ? 'Done' : `${it.minutes} min`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card-flat px-4 py-3 text-[13.5px] leading-relaxed text-on-surface-variant">
            Nothing set this week. Put {first} in a group with a program, or give them one of their own below.
          </p>
        )}
      </section>

      <section>
        <p className="eyebrow mb-3">Groups</p>
        {groups.length ? (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <Chip key={g.id} on={g.member} onClick={() => run(() => setMembership(g.id, userId, !g.member))}>{g.name}</Chip>
            ))}
          </div>
        ) : <p className="text-[13.5px] text-on-surface-variant">No groups yet. <Link href="/coach/groups/new" className="font-semibold text-on-surface underline underline-offset-4">Make one</Link>.</p>}
      </section>

      <section>
        <p className="eyebrow mb-3">On their own</p>
        {!!own.length && (
          <ul className="card mb-3 divide-y divide-outline-variant">
            {own.map((o) => (
              <li key={o.program_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold text-on-surface">{o.label}</span>
                  <span className="block text-[12.5px] text-on-surface-variant">Started {o.starts_on}</span>
                </span>
                <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => run(() => unassignProgram(userId, o.program_id))}>Stop</button>
              </li>
            ))}
          </ul>
        )}
        {programs.filter((p) => !own.some((o) => o.program_id === p.id)).length ? (
          <div className="flex gap-2">
            <label className="text-field flex-1">
              <select value={program} onChange={(e) => setProgram(e.target.value)} aria-label="Program">
                <option value="">Give {first} a program…</option>
                {programs.filter((p) => !own.some((o) => o.program_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.weeks} wks)</option>)}
              </select>
            </label>
            <button type="button" disabled={busy || !program} className="btn-primary btn-sm pressable self-center"
                    onClick={() => run(() => assignProgram(userId, program), () => setProgram(''))}>Start</button>
          </div>
        ) : !programs.length && <p className="text-[13.5px] text-on-surface-variant">For 1-to-1 players. <Link href="/coach/programs/new" className="font-semibold text-on-surface underline underline-offset-4">Make a program</Link> first.</p>}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="eyebrow">Just for {first}, this week</p>
          {!adding && !!drills.length && (
            <button type="button" className="text-[13px] font-semibold text-on-surface underline underline-offset-4" onClick={() => setAdding(true)}>+ Add a drill</button>
          )}
        </div>
        {!!addons.length && (
          <ul className="card mb-3 divide-y divide-outline-variant">
            {addons.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold text-on-surface">{a.name}</span>
                  {a.note && <span className="block text-[12.5px] leading-snug text-on-surface-variant">{a.note}</span>}
                </span>
                <button type="button" disabled={busy} className="icon-btn" aria-label="Remove" onClick={() => run(() => removeAddon(a.id))}>×</button>
              </li>
            ))}
          </ul>
        )}
        {!drills.length && <p className="text-[13.5px] text-on-surface-variant">Add drills under Programs to give {first} extra work.</p>}
        {adding && (
          <div className="card space-y-4 p-4">
            <button type="button" disabled={busy} className="btn-ghost btn-sm pressable w-full"
                    onClick={() => start(async () => {
                      setErr('');
                      const r = await suggestAddon(userId);
                      if (!r.ok) { setErr(r.error); return; }
                      setDrill(r.drillId); setNote(r.note); setWhy(`${r.by === 'ai' ? 'Suggested' : 'Picked'}: ${r.why}`);
                    })}>
              {busy ? 'Thinking…' : `Suggest one for ${first}`}
            </button>
            {why && <p className="text-[12.5px] font-semibold text-on-surface-variant">{why}</p>}
            <label className="text-field">
              <span>Drill</span>
              <select value={drill} onChange={(e) => setDrill(e.target.value)}>
                <option value="">Choose a drill</option>
                {drills.map((d) => <option key={d.id} value={d.id}>{d.name}{d.amount ? ` · ${d.amount}` : ''}</option>)}
              </select>
            </label>
            <label className="text-field">
              <span>Note to {first} (optional)</span>
              <textarea rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Left foot only this time." />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" className="btn-ghost btn-sm pressable" onClick={() => { setAdding(false); setDrill(''); setNote(''); setWhy(''); }}>Cancel</button>
              <button type="button" disabled={busy || !drill} className="btn-primary btn-sm pressable"
                      onClick={() => run(() => addAddon(userId, drill, note), () => { setAdding(false); setDrill(''); setNote(''); setWhy(''); })}>Add to week</button>
            </div>
          </div>
        )}
      </section>
      {err && <p role="alert" className="text-[13px] font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
