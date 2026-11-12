import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import Link from 'next/link';
import { PHASES, BLOCK_WEEKS, WEEK_TEMPLATE } from '@/lib/speed';
import { serverClient } from '@/lib/supabase/server';
import { SpeedYear } from '@/components/SpeedYear';

/**
 * Speed is a long-term program rather than a session or a week. It leads with
 * where you are in it — today, this week (SpeedYear) — and below that reads
 * as the reference: the year, the block, and the week, the three clocks a
 * player is on at once.
 */
const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-on-surface-variant" fill="none"
       stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
);

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
        <BandTitle>Get faster</BandTitle>
      </BrandBand>

      {/* What to do now leads: today's session, test day, or where to start. */}
      <SpeedYear completions={completions} />

      <section className="mt-9">
        <h2 className="h-sec mb-3">My tests</h2>
        <Link href="/speed/test" className="card pressable flex min-h-[68px] items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold leading-snug text-on-surface">Test day</div>
            <div className="mt-0.5 text-[13.5px] font-semibold text-on-surface-variant">See your best times and jumps</div>
          </div>
          <Chevron />
        </Link>
      </section>

      <section className="mt-9">
        <h2 className="h-sec mb-3">The whole year</h2>
        <div className="stagger grid grid-cols-1 gap-2.5">
          {PHASES.map((p) => (
            <Link key={p.id} href={`/speed/${p.id}`}
              className="card pressable flex min-h-[68px] items-center gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-brand text-[16px] font-extrabold">
                {p.number}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-bold leading-snug text-on-surface">{p.name}</div>
                <div className="mt-0.5 text-[13.5px] font-semibold text-on-surface-variant">{p.months}</div>
              </div>
              <Chevron />
            </Link>
          ))}
        </div>
      </section>

      {/* How the year is put together and why: for whoever is helping, folded away. */}
      <details className="card-flat group mt-9">
        <summary className="pressable flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 px-4 text-[16px] font-bold text-on-surface">
          For parents and coaches
          <span className="transition-transform group-open:rotate-90"><Chevron /></span>
        </summary>
        <div className="space-y-6 border-t border-outline-variant p-4">
          <div>
            <p className="mb-2 text-[15px] font-bold text-on-surface">Every four weeks</p>
            <ul className="space-y-1.5 text-[14px] leading-snug text-on-surface-variant">
              {BLOCK_WEEKS.map((w) => (
                <li key={w.week}><b className="font-semibold text-on-surface">Week {w.week}: {w.name}.</b> {w.load}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[15px] font-bold text-on-surface">Every week</p>
            <ul className="space-y-1.5 text-[14px] leading-snug text-on-surface-variant">
              {WEEK_TEMPLATE.map((t) => (
                <li key={t.day}><b className="font-semibold text-on-surface">{t.day}:</b> {t.label}{t.minutes ? `, ${t.minutes} min` : ''}</li>
              ))}
            </ul>
          </div>
          <p className="text-[14px] leading-snug text-on-surface-variant">
            Written for ages 13 to 16. Speed is trained fresh: sprints come first, after the warm-up, with full rest.
            Each test result sets the next four weeks.
          </p>
          <Link href="/speed/science" className="btn-ghost pressable w-full">The science behind it</Link>
        </div>
      </details>
    </div>
  );
}
