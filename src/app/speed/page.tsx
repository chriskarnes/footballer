import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import Link from 'next/link';
import { PHASES, BLOCK_WEEKS, WEEK_TEMPLATE, SPEED_SESSIONS, SOURCES } from '@/lib/speed';
import { serverClient } from '@/lib/supabase/server';
import { SpeedYear } from '@/components/SpeedYear';

/**
 * Speed is a long-term program rather than a session or a week. It leads with
 * where you are in it — today, this week (SpeedYear) — and below that reads
 * as the reference: the year, the block, and the week, the three clocks a
 * player is on at once.
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
      <BrandBand>
        <BandTag>Speed</BandTag>
        <BandTitle>Speed &amp; Stamina</BandTitle>
        <p className="mt-3 text-[16px] font-semibold text-on-surface-brand-variant">A year of sessions to get faster. For ages 13 and up.</p>
      </BrandBand>

      <SpeedYear completions={completions} />

      {/* The two things to press first: today's test, and the science that
          backs the plan. Test day is the reorder counter of this module. */}
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <Link href="/speed/test" className="card pressable p-4">
          <div className="h-card">Test day</div>
          <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">Your card and bests</div>
        </Link>
        <Link href="/speed/science" className="card pressable p-4">
          <div className="h-card">The science</div>
          <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">{SOURCES.length} papers, read plainly</div>
        </Link>
      </div>

      <section className="mt-9">
        <h2 className="h-sec mb-3">The year</h2>
        <div className="stagger grid grid-cols-1 gap-2.5">
          {PHASES.map((p) => (
            <Link key={p.id} href={`/speed/${p.id}`}
              className="card pressable flex items-center gap-4 p-4">
              <span className="font-brand text-[13px] font-bold text-on-surface-variant">
                {String(p.number).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="h-card truncate">{p.name}</div>
                <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
                  {p.months} · 3 blocks · {SPEED_SESSIONS.filter((s) => s.phase === p.id).length} sessions
                </div>
              </div>
              <svg viewBox="0 0 24 24" aria-hidden="true"
                   className="h-4 w-4 shrink-0 text-on-surface-variant" fill="none"
                   stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="h-sec mb-3">Every block</h2>
        <div className="card-flat divide-y divide-outline-variant">
          {BLOCK_WEEKS.map((w) => (
            <div key={w.week} className="flex items-start gap-4 p-4">
              <span className="font-brand text-[13px] font-bold text-on-surface-variant">W{w.week}</span>
              <div className="min-w-0 flex-1">
                <div className="h-card">{w.name}</div>
                <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">{w.load}</div>
              </div>
              <span className="text-[11.5px] font-semibold text-on-surface-variant">{w.feel}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-on-surface-variant">
          A new drill every four weeks, a number to beat every four weeks. The test result sets
          the next block&rsquo;s spacing, distances and sets, so the plan is always the athlete&rsquo;s own.
        </p>
      </section>

      <section className="mt-9">
        <h2 className="h-sec mb-3">Every week</h2>
        <div className="card-flat divide-y divide-outline-variant">
          {WEEK_TEMPLATE.map((t) => (
            <div key={t.day} className="flex items-center gap-4 p-4">
              <span className="w-8 font-brand text-[13px] font-bold text-on-surface-variant">{t.day}</span>
              <div className={`min-w-0 flex-1 text-[14px] font-semibold ${t.kind ? '' : 'text-on-surface-variant'}`}>
                {t.label}
              </div>
              {!!t.minutes && (
                <span className="font-brand text-[13px] font-bold tracking-tighter">{t.minutes}m</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-on-surface-variant">
          Speed is trained fresh: sprints come first, after the warm-up, with full rest.
          In-season, Mon and Thu shrink to 30 minutes and Fri is dropped after a midweek match.
        </p>
      </section>
    </div>
  );
}
