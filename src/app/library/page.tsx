import { getPrograms, getSessions } from '@/lib/library';
import { formatTouches } from '@/lib/session-builder';
import { ProgramSheet } from '@/components/ProgramSheet';

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

              <ProgramSheet programs={inCat} sessions={sessions} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
