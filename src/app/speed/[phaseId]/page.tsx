import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { phaseById, sessionsFor, sessionSeconds } from '@/lib/speed';

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
      <p className="mt-3 text-[16px] font-medium leading-snug text-on-surface-variant">{phase.goal}</p>

      <div className="stagger mt-8 space-y-8">
        {([1, 2, 3] as const).map((b) => {
          const mine = sessionsFor(phase.id, b);
          return (
            <section key={b}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="h-sec">Weeks {(b - 1) * 4 + 1} to {b * 4}</h2>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {mine.map((s) => (
                  <Link key={s.id} href={`/speed/session/${s.id}`}
                    className="card pressable flex min-h-[68px] items-center gap-4 p-4">
                    <span className="w-10 shrink-0 font-brand text-[15px] font-extrabold text-on-surface">{s.day}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[16px] font-bold leading-snug text-on-surface">{s.name}</div>
                      <div className="mt-0.5 text-[13.5px] font-semibold text-on-surface-variant">
                        {Math.round(sessionSeconds(s) / 60)} min
                      </div>
                    </div>
                  </Link>
                ))}
                <Link href="/speed/test" className="card-flat pressable flex min-h-[68px] items-center gap-4 p-4">
                  <span className="w-10 shrink-0 font-brand text-[15px] font-extrabold text-on-surface">Thu</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-bold leading-snug text-on-surface">Test day</div>
                    <div className="mt-0.5 text-[13.5px] font-semibold text-on-surface-variant">
                      In week {b * 4}
                    </div>
                  </div>
                </Link>
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-9 rounded-large-increased border border-brand-edge bg-surface-brand p-6 shadow-level3">
        <p className="text-[17px] font-extrabold text-on-surface-brand">Ready to move on when</p>
        <p className="mt-2 text-[15px] leading-snug text-on-surface-brand">{phase.gate}</p>
        <p className="mt-3 text-[14px] font-medium text-on-surface-brand-variant">
          Not there yet? Repeat the last four weeks.
        </p>
      </section>
    </div>
  );
}
