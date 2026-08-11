import Link from 'next/link';
import { getPrograms, getSessions } from '@/lib/library';
import { formatTouches } from '@/lib/session-builder';

const ART: Record<string, string> = {
  'Technical': 'from-[#0B3A24] to-[#1E7F4B]',
  'Physical': 'from-[#101F31] to-[#28618C]',
  'Finishing & Crossing': 'from-[#3A2708] to-[#A0700F]',
};
const KID: Record<string, string> = {
  'Technical': 'Ball Skills', 'Physical': 'Speed & Strength',
  'Finishing & Crossing': 'Scoring Goals',
};

export default async function LibraryPage() {
  const [programs, sessions] = await Promise.all([getPrograms(), getSessions()]);
  const categories = ['Technical', 'Physical', 'Finishing & Crossing'];

  return (
    <div className="animate-pop">
      <p className="eyebrow mb-3">Library</p>
      <h1 className="h-hero">Every drill<br />and programme</h1>
      <p className="mt-3.5 text-[15px] text-muted">786 drills across 17 programmes.</p>

      <div className="stagger mt-9 space-y-9">
        {categories.map((cat) => {
          const inCat = programs.filter((p) => p.category === cat);
          if (!inCat.length) return null;
          const drills = inCat.reduce(
            (a, p) => a + sessions.filter((s) => s.program_id === p.id)
              .reduce((x) => x, 0) + 0, 0);
          const touches = inCat.reduce((a, p) => a + p.touches, 0);
          return (
            <section key={cat}>
              <div className={`relative mb-4 overflow-hidden rounded-card bg-gradient-to-br
                               ${ART[cat]} p-6 shadow-lift`}>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/50">
                  {cat}
                </p>
                <h2 className="mt-1.5 font-display text-[24px] font-extrabold leading-none
                               tracking-tightest text-white">{KID[cat]}</h2>
                <p className="mt-2.5 text-[12.5px] font-semibold text-white/60">
                  {inCat.length} programmes · {formatTouches(touches)} touches
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {inCat.map((p) => {
                  const n = sessions.filter((s) => s.program_id === p.id).length;
                  return (
                    <Link key={p.id} href={`/library/${p.id}`}
                      className="card group flex items-center gap-4 p-4 transition
                                 active:scale-[.99] hover:shadow-lift">
                      <div className="min-w-0 flex-1">
                        <div className="h-card truncate">{p.name}</div>
                        <div className="mt-1 text-[12.5px] font-medium text-muted">
                          {p.level} · {n} sessions · {formatTouches(p.touches)} touches
                        </div>
                      </div>
                      <span className="font-display text-[15px] font-bold tracking-tighter text-faint">
                        {p.total_minutes}m
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
