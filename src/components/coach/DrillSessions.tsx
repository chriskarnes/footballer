'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setDrillSessions } from '@/app/coach/content-actions';
import { CheckIcon } from '@/components/Chip';

export type ProgramWeeks = { id: string; name: string; weeks: { week: number; sessions: { id: string; name: string; has: boolean }[] }[] };

/**
 * The sessions this drill is in, as checkboxes under each program and week.
 * Tick to add it (at the end of the session), untick to take it out.
 */
export function DrillSessions({ drillId, programs, fresh }: { drillId: string; programs: ProgramWeeks[]; fresh?: boolean }) {
  const initial = programs.flatMap((p) => p.weeks.flatMap((w) => w.sessions.filter((s) => s.has).map((s) => s.id)));
  const [on, setOn] = useState<Set<string>>(new Set(initial));
  const [saved, setSaved] = useState(new Set(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const changed = on.size !== saved.size || [...on].some((id) => !saved.has(id));

  const flip = (id: string) => setOn((xs) => { const n = new Set(xs); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = () => start(async () => {
    setError(null);
    const r = await setDrillSessions(drillId, [...on]);
    if (!r.ok) { setError(r.error); return; }
    setSaved(new Set(on));
    if (fresh) router.push('/coach/drills'); else router.refresh();
  });

  if (!programs.some((p) => p.weeks.length)) {
    return <p className="text-[13.5px] text-on-surface-variant">No sessions yet. Build one in a program, then add drills to it.</p>;
  }

  return (
    <div>
      <div className="space-y-5">
        {programs.filter((p) => p.weeks.length).map((p) => (
          <div key={p.id}>
            <p className="text-[13px] font-bold text-on-surface">{p.name}</p>
            <div className="mt-2 space-y-3">
              {p.weeks.map((w) => (
                <div key={w.week} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="w-16 shrink-0 text-[12px] font-semibold text-on-surface-variant">Week {w.week}</span>
                  <div className="flex flex-wrap gap-2">
                    {w.sessions.map((s) => (
                      <button key={s.id} type="button" onClick={() => flip(s.id)} aria-pressed={on.has(s.id)}
                              className={`chip ${on.has(s.id) ? 'chip-on' : ''}`}>
                        {on.has(s.id) && <CheckIcon />}{s.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-on-surface">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button type="button" onClick={save} disabled={pending || (!changed && !fresh)} className="btn-primary btn-sm pressable">
          {pending ? 'Saving…' : fresh ? (on.size ? `Add to ${on.size} ${on.size === 1 ? 'session' : 'sessions'}` : 'Done') : 'Save sessions'}
        </button>
        {fresh && <Link href="/coach/drills" className="btn-ghost btn-sm pressable">Skip</Link>}
      </div>
    </div>
  );
}
