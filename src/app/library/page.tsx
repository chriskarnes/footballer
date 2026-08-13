import Link from 'next/link';
import { getPrograms, getSessions } from '@/lib/library';
import { formatTouches } from '@/lib/session-builder';

/**
 * The three category gradients are --forge-category-* extensions, not md.sys
 * roles: M3 has no mechanism for "three sibling categories that must stay
 * visually distinct". Each takes a different ramp that is still inside the
 * brief — primary navy, tertiary cyan-blue, primary at a lighter tone.
 *
 * Text on them uses --forge-on-category, which is FIXED rather than
 * scheme-following. The gradients do not flip between light and dark, so text
 * over them must not either — reusing an inverse role here is what put black
 * text on a green card when the dark scheme was first switched on.
 */
const ART: Record<string, string> = {
  'Technical': 'from-forge-category-technical-dim to-forge-category-technical',
  'Physical': 'from-forge-category-physical-dim to-forge-category-physical',
  'Finishing & Crossing': 'from-forge-category-finishing-dim to-forge-category-finishing',
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
      {/* "programme" was only ever in the headings — every card title already
          said "Program". Normalised to US, and the hero is one line. */}
      <h1 className="h-hero">Training Programs</h1>
      <p className="mt-3.5 text-[15px] text-on-surface-variant">786 drills across 17 programs.</p>

      <div className="stagger mt-9 space-y-9">
        {categories.map((cat) => {
          const inCat = programs.filter((p) => p.category === cat);
          if (!inCat.length) return null;
          const touches = inCat.reduce((a, p) => a + p.touches, 0);
          return (
            <section key={cat}>
              <div className={`relative mb-4 overflow-hidden rounded-large-increased bg-gradient-to-br
                               ${ART[cat]} p-6 shadow-level3`}>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-on-category-variant">
                  {cat}
                </p>
                <h2 className="mt-1.5 font-brand text-[24px] font-extrabold leading-none
                               tracking-tightest text-on-category">{KID[cat]}</h2>
                <p className="mt-2.5 text-[12.5px] font-semibold text-on-category-variant">
                  {inCat.length} programs · {formatTouches(touches)} touches
                </p>
              </div>

              {/* A program is a destination again, not a dialog. The sheet's job
                  was to stop a mis-tap on the live tab bar dropping you into Plan;
                  the program page answers that with an explicit back control
                  instead, and the App Router restores your scroll position in the
                  list on the way back. */}
              <div className="grid grid-cols-1 gap-2.5">
                {inCat.map((p) => {
                  const n = sessions.filter((s) => s.program_id === p.id).length;
                  return (
                    <Link key={p.id} href={`/library/${p.id}`}
                      className="card pressable flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="h-card truncate">{p.name}</div>
                        {/* No minute total. The number that helps is per drill, on
                            Train — "384m" against a program is not actionable. */}
                        <div className="mt-1 text-[12.5px] font-medium text-on-surface-variant">
                          {p.level} · {n} sessions · {formatTouches(p.touches)} touches
                        </div>
                      </div>
                      <svg viewBox="0 0 24 24" aria-hidden="true"
                           className="h-4 w-4 shrink-0 text-on-surface-variant" fill="none"
                           stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
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
