'use client';
import { offline } from '@/lib/plain-error';
import Link from 'next/link';
import { useToast } from '@/components/coach/Toast';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setDrillSessions } from '@/app/coach/content-actions';
import { CheckIcon } from '@/components/Chip';

export type ProgramWeeks = { id: string; name: string; weeks: { week: number; sessions: { id: string; name: string; has: boolean }[] }[] };

type Pick = { id: string; name: string; has: boolean };

/**
 * The sessions this drill is in: the library's (which follow into every
 * program week they're in), then any program session of its own. Tick to
 * add it (at the end of the session), untick to take it out.
 */
export function DrillSessions({ drillId, library = [], programs, fresh }: {
  drillId: string; library?: Pick[]; programs: ProgramWeeks[]; fresh?: boolean;
}) {
  // Library ids are kept apart from program-session ids by a prefix.
  const lib = (id: string) => `lib:${id}`;
  const initial = [
    ...library.filter((s) => s.has).map((s) => lib(s.id)),
    ...programs.flatMap((p) => p.weeks.flatMap((w) => w.sessions.filter((s) => s.has).map((s) => s.id))),
  ];
  const [on, setOn] = useState<Set<string>>(new Set(initial));
  const [saved, setSaved] = useState(new Set(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const changed = on.size !== saved.size || [...on].some((id) => !saved.has(id));

  const flip = (id: string) => setOn((xs) => { const n = new Set(xs); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = () => start(async () => {
    setError(null);
    const ids = [...on];
    const r = await setDrillSessions(drillId, ids.filter((x) => !x.startsWith('lib:')),
      ids.filter((x) => x.startsWith('lib:')).map((x) => x.slice(4))).catch(offline);
    // On failure the page is read again, so the ticks show what was saved.
    if (!r.ok) { setError(r.error); router.refresh(); return; }
    setSaved(new Set(on));
    toast('Saved.');
    if (fresh) router.push('/coach/drills'); else router.refresh();
  });

  if (!library.length && !programs.some((p) => p.weeks.length)) {
    return <p className="text-body text-on-surface-variant">No sessions yet. <Link href="/coach/sessions/new" className="font-semibold text-on-surface underline underline-offset-4">Build one</Link>, then add drills to it.</p>;
  }

  const chip = (id: string, name: string) => (
    <button key={id} type="button" onClick={() => flip(id)} aria-pressed={on.has(id)}
            className={`chip ${on.has(id) ? 'chip-on' : ''}`}>
      {on.has(id) && <CheckIcon />}{name}
    </button>
  );

  return (
    <div>
      <div className="space-y-5">
        {!!library.length && (
          <div>
            <p className="text-body font-bold text-on-surface">Your sessions</p>
            <div className="mt-2 flex flex-wrap gap-2">{library.map((s) => chip(lib(s.id), s.name))}</div>
          </div>
        )}
        {programs.filter((p) => p.weeks.length).map((p) => (
          <div key={p.id}>
            <p className="text-body font-bold text-on-surface">{p.name}</p>
            <div className="mt-2 space-y-3">
              {p.weeks.map((w) => (
                <div key={w.week} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="w-16 shrink-0 text-caption font-semibold text-on-surface-variant">Week {w.week}</span>
                  <div className="flex flex-wrap gap-2">
                    {w.sessions.map((s) => chip(s.id, s.name))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-body font-semibold text-on-surface">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button type="button" onClick={save} disabled={pending || (!changed && !fresh)} className="btn-primary btn-sm pressable">
          {pending ? 'Saving…' : fresh ? (on.size ? `Add to ${on.size} ${on.size === 1 ? 'session' : 'sessions'}` : 'Done') : 'Save'}
        </button>
        {fresh && <Link href="/coach/drills" className="btn-ghost btn-sm pressable">Skip</Link>}
      </div>
    </div>
  );
}
