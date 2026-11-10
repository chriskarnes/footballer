'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addAddon, assignProgram, removeAddon, setMembership, unassignProgram } from '@/app/coach/content-actions';
import { suggestAddon } from '@/app/coach/suggest';
import { Chip } from '@/components/Chip';
import type { DrillRow, WeekItem } from '@/lib/academy-week';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Runs an action, shows its error, refreshes the page when it worked. */
function useRun() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  const run = (f: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    setErr('');
    const r = await f();
    if (!r.ok) setErr(r.error ?? 'That didn’t work.'); else { after?.(); router.refresh(); }
  });
  return { busy, start, err, setErr, run };
}

const Err = ({ err }: { err: string }) => err ? <p role="alert" className="mt-2 text-[13px] font-semibold text-on-surface">{err}</p> : null;

/** This week exactly as the player sees it, extras included. */
export function WeekList({ first, week }: { first: string; week: WeekItem[] }) {
  return week.length ? (
    <ul className="card divide-y divide-outline-variant">
      {week.map((it) => (
        <li key={it.key} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className={`block truncate text-[14.5px] font-semibold ${it.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{it.title}</span>
            <span className="block truncate text-[12.5px] text-on-surface-variant">
              {DAYS[it.weekday]}{it.practice && ' (practice day)'} · {it.kind === 'addon' ? 'Extra' : it.kind === 'custom' ? 'Custom week' : [it.groups.join(' & ') || 'Own program', it.from].join(' · ')}
            </span>
          </span>
          <span className="shrink-0 text-[12.5px] font-semibold text-on-surface-variant">{it.done ? 'Done' : `${it.minutes} min`}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="card-flat px-4 py-3 text-[13.5px] leading-relaxed text-on-surface-variant">
      Nothing set this week. Put {first} in a group with a program, or give them their own below.
    </p>
  );
}

/** Where a program comes from: their groups (tap to change), and programs of their own. */
export function ProgramSetup({ userId, first, groups, programs, own }: {
  userId: string; first: string;
  groups: { id: string; name: string; member: boolean }[];
  programs: { id: string; name: string; weeks: number }[];
  own: { program_id: string; starts_on: string; label: string }[];
}) {
  const { busy, err, run } = useRun();
  const [program, setProgram] = useState('');
  const left = programs.filter((p) => !own.some((o) => o.program_id === p.id));

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 text-[14px] font-bold text-on-surface">Groups</div>
        {groups.length ? (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <Chip key={g.id} on={g.member} onClick={() => run(() => setMembership(g.id, userId, !g.member))}>{g.name}</Chip>
            ))}
          </div>
        ) : <p className="text-[13.5px] text-on-surface-variant">No groups yet. <Link href="/coach/groups/new" className="font-semibold text-on-surface underline underline-offset-4">Make one</Link>.</p>}
      </section>

      <section>
        <div className="mb-2 text-[14px] font-bold text-on-surface">Own program</div>
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
        {left.length ? (
          <div className="flex gap-2">
            <label className="text-field flex-1">
              <select value={program} onChange={(e) => setProgram(e.target.value)} aria-label="Program">
                <option value="">Give {first} a program…</option>
                {left.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.weeks} wks)</option>)}
              </select>
            </label>
            <button type="button" disabled={busy || !program} className="btn-primary btn-sm pressable self-center"
                    onClick={() => run(() => assignProgram(userId, program), () => setProgram(''))}>Start</button>
          </div>
        ) : !programs.length && <p className="text-[13.5px] text-on-surface-variant">Just for {first}, apart from any group. <Link href="/coach/programs/new" className="font-semibold text-on-surface underline underline-offset-4">Make a program</Link> first.</p>}
      </section>
      <Err err={err} />
    </div>
  );
}

/** Extras: a drill or two on top of this week, however the week is set. Suggest can pick one. */
export function Extras({ userId, first, addons, drills }: {
  userId: string; first: string;
  addons: { id: string; name: string; note: string | null }[];
  drills: DrillRow[];
}) {
  const { busy, start, err, setErr, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [drill, setDrill] = useState('');
  const [note, setNote] = useState('');
  const [why, setWhy] = useState('');
  const reset = () => { setAdding(false); setDrill(''); setNote(''); setWhy(''); };

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="eyebrow">Extras this week</p>
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
      {!addons.length && !adding && !!drills.length && (
        <p className="text-[13.5px] text-on-surface-variant">A drill on top of {first}&rsquo;s week, with a note if you like.</p>
      )}
      {!drills.length && <p className="text-[13.5px] text-on-surface-variant">Add drills under Library to give {first} extras.</p>}
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
            <button type="button" className="btn-ghost btn-sm pressable" onClick={reset}>Cancel</button>
            <button type="button" disabled={busy || !drill} className="btn-primary btn-sm pressable"
                    onClick={() => run(() => addAddon(userId, drill, note), reset)}>Add to week</button>
          </div>
        </div>
      )}
      <Err err={err} />
    </section>
  );
}
