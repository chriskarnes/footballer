import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { KIND_LABELS, phaseById, sessionsFor, sessionSeconds } from '@/lib/speed';

/**
 * One phase: its goal, the three blocks with their five sessions each, and
 * the gate out. Sessions are listed in week order (Mon → Sat) so a block reads
 * as the week it is.
 */
export default async function PhasePage({ params }: { params: Promise<{ phaseId: string }> }) {
  const { phaseId } = await params;
  const phase = phaseById(phaseId);
  if (!phase) notFound();

  return (
    <div className="animate-pop">
      <BackLink href="/speed" label="Speed" />

      <h1 className="h-page">{phase.name}</h1>
      <p className="mt-3 text-body-lg font-semibold text-primary">
        Up to {phase.sprintCap} m of sprints and {phase.contactCap} jumps a session
      </p>
      <p className="mt-4 text-title-sm leading-relaxed text-on-surface-variant">{phase.goal}</p>

      <div className="stagger mt-8 space-y-8">
        {([1, 2, 3] as const).map((b) => {
          const mine = sessionsFor(phase.id, b);
          return (
            <section key={b}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="h-card">Block {b}</h2>
                <span className="text-body font-medium text-on-surface-variant">
                  Weeks {(b - 1) * 4 + 1}–{b * 4} · test day in week {b * 4}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {mine.map((s) => (
                  <Link key={s.id} href={`/speed/session/${s.id}`}
                    className="card pressable flex items-center gap-4 p-4">
                    <span className="w-9 font-brand text-body font-bold text-on-surface-variant">{s.day}</span>
                    <div className="min-w-0 flex-1">
                      <div className="h-card truncate">{s.name}</div>
                      <div className="mt-1 text-body font-medium text-on-surface-variant">
                        {KIND_LABELS[s.kind]}{s.sprintMetres ? ` · ${s.sprintMetres} m sprinting` : ''}
                        {s.where === 'indoor' ? ' · indoor' : ''}
                      </div>
                    </div>
                    <div className="font-brand text-body-lg font-bold tracking-brand-snug">
                      {Math.round(sessionSeconds(s) / 60)}m
                    </div>
                  </Link>
                ))}
                <Link href="/speed/test" className="card-flat pressable flex items-center gap-4 p-4">
                  <span className="w-9 font-brand text-body font-bold text-on-surface-variant">Thu</span>
                  <div className="min-w-0 flex-1">
                    <div className="h-card">Test day</div>
                    <div className="mt-1 text-body font-medium text-on-surface-variant">
                      Week {b * 4} · test day, in place of Thursday’s session · 45 min after the warm-up
                    </div>
                  </div>
                </Link>
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-9 brand-card p-6">
        <p className="eyebrow text-on-surface-brand-variant">
          Gate to {phase.number < 4 ? `Phase ${phase.number + 1}` : 'next year'}
        </p>
        <p className="mt-2 text-title-sm leading-relaxed text-on-surface-brand">{phase.gate}</p>
        <p className="mt-3 text-body font-medium text-on-surface-brand-variant">
          An athlete who fails a gate repeats the last block, not the whole phase.
        </p>
      </section>
    </div>
  );
}
