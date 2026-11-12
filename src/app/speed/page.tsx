import Link from 'next/link';
import { BrandBand } from '@/components/BrandBand';
import { PHASES, BLOCK_WEEKS, WEEK_TEMPLATE, SPEED_SESSIONS, SOURCES } from '@/lib/speed';
import { serverClient } from '@/lib/supabase/server';
import { SpeedNow, SpeedWeek, SpeedYearProvider } from '@/components/SpeedYear';

const Chevron = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none"
       stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
);

/**
 * Speed is a long-term program, but the tab leads like Train does: one band
 * with what to do now, then this week. Test day is the player's too. The
 * rest (the year, the block, the week's shape, the science, where the year
 * started) is for the adults, in one closed section at the bottom.
 */
export default async function SpeedPage() {
  // Finished speed sessions from the last eight days, to tick this week off.
  // Signed out there are none, and the year runs without ticks.
  let completions: { source_ref: string | null; completed_at: string | null }[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const db = await serverClient();
      const { data: auth } = await db.auth.getUser();
      if (auth.user) {
        const since = new Date(Date.now() - 8 * 86400000).toISOString();
        const { data } = await db.from('workouts').select('source_ref,completed_at')
          .eq('status', 'completed').eq('source', 'speed').gte('completed_at', since);
        completions = data ?? [];
      }
    } catch { /* not configured */ }
  }

  return (
    <div className="animate-pop">
      <SpeedYearProvider completions={completions}>
        <BrandBand compact><SpeedNow /></BrandBand>
        <SpeedWeek />

        <Link href="/speed/test" className="card pressable mt-4 flex min-h-[68px] items-center gap-3.5 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold leading-snug text-on-surface">Test day</span>
            <span className="mt-0.5 block text-[14px] font-semibold text-on-surface-variant">Your card and your bests</span>
          </span>
          <Chevron className="h-5 w-5 shrink-0 text-on-surface-variant" />
        </Link>

        <details className="group mt-9">
          <summary className="card pressable flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4
                              [&::-webkit-details-marker]:hidden">
            <span className="text-[16px] font-bold text-on-surface">For parents and coaches</span>
            <Chevron className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-open:rotate-90" />
          </summary>

          <div className="mt-5 space-y-9">
            <section>
              <h2 className="h-sec mb-3">The year</h2>
              <div className="grid grid-cols-1 gap-2.5">
                {PHASES.map((p) => (
                  <Link key={p.id} href={`/speed/${p.id}`} className="card pressable flex items-center gap-4 p-4">
                    <span className="font-brand text-[14px] font-bold text-on-surface-variant">
                      {String(p.number).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="h-card truncate">{p.name}</div>
                      <div className="mt-1 text-[14px] font-medium leading-snug text-on-surface-variant">
                        {p.months} · {SPEED_SESSIONS.filter((s) => s.phase === p.id).length} sessions
                      </div>
                      {/* The phase's limits, per session. */}
                      <div className="mt-0.5 text-[14px] font-medium leading-snug text-on-surface-variant">
                        Up to {p.sprintCap} m of sprints and {p.contactCap} jumps a session
                      </div>
                    </div>
                    <Chevron className="h-4 w-4 shrink-0 text-on-surface-variant" />
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="h-sec mb-3">Every block</h2>
              <div className="card-flat divide-y divide-outline-variant">
                {BLOCK_WEEKS.map((w) => (
                  <div key={w.week} className="flex items-start gap-4 p-4">
                    <span className="font-brand text-[14px] font-bold text-on-surface-variant">W{w.week}</span>
                    <div className="min-w-0 flex-1">
                      <div className="h-card">{w.name}</div>
                      <div className="mt-1 text-[14px] font-medium text-on-surface-variant">{w.load}</div>
                    </div>
                    <span className="text-[14px] font-semibold text-on-surface-variant">{w.feel}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-on-surface-variant">
                A new drill every four weeks, a number to beat every four weeks. The test result sets
                the next block&rsquo;s spacing, distances and sets, so the plan is always the athlete&rsquo;s own.
              </p>
            </section>

            <section>
              <h2 className="h-sec mb-3">Every week</h2>
              <div className="card-flat divide-y divide-outline-variant">
                {WEEK_TEMPLATE.map((t) => (
                  <div key={t.day} className="flex items-center gap-4 p-4">
                    <span className="w-9 font-brand text-[14px] font-bold text-on-surface-variant">{t.day}</span>
                    <div className={`min-w-0 flex-1 text-[15px] font-semibold ${t.kind ? '' : 'text-on-surface-variant'}`}>
                      {t.label}
                    </div>
                    {!!t.minutes && (
                      <span className="font-brand text-[14px] font-bold tracking-tighter">{t.minutes}m</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-on-surface-variant">
                Speed is trained fresh: sprints come first, after the warm-up, with full rest.
                In-season, Mon and Thu shrink to 30 minutes and Fri is dropped after a midweek match.
              </p>
            </section>

            <Link href="/speed/science" className="card pressable flex min-h-[68px] items-center gap-3.5 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="h-card block">The science</span>
                <span className="mt-0.5 block text-[14px] font-medium text-on-surface-variant">{SOURCES.length} papers, read plainly</span>
              </span>
              <Chevron className="h-5 w-5 shrink-0 text-on-surface-variant" />
            </Link>
          </div>
        </details>
      </SpeedYearProvider>
    </div>
  );
}
