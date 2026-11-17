import Link from 'next/link';
import { libraryAllowed } from '@/lib/library-gate';
import { LibraryLocked } from '@/components/LibraryLocked';
import { AcademyLibrary } from '@/components/AcademyLibrary';
import { BandTag, BandTitle, BrandBand } from '@/components/BrandBand';
import { getPrograms, getSessions } from '@/lib/library';

/**
 * The three category gradients are --app-category-* extensions, not md.sys
 * roles: M3 has no mechanism for "three sibling categories that must stay
 * visually distinct". On a monochrome palette they separate by value rather
 * than hue — a near-black, a mid and a light band of the neutral ramp.
 *
 * Text on them uses --app-on-category, which is FIXED rather than
 * scheme-following. The gradients do not flip between light and dark, so text
 * over them must not either — reusing an inverse role here is what put black
 * text on a green card when the dark scheme was first switched on.
 */
const ART: Record<string, string> = {
  'Technical': 'from-app-category-technical-dim to-app-category-technical',
  'Physical': 'from-app-category-physical-dim to-app-category-physical',
  'Finishing & Crossing': 'from-app-category-finishing-dim to-app-category-finishing',
};
/** The levels worth saying: "General" and "All Levels" tell a player nothing. */
const LEVELS = new Set(['Beginner', 'Advanced', 'Elite']);
const KID: Record<string, string> = {
  'Technical': 'Ball Skills', 'Physical': 'Fitness',
  'Finishing & Crossing': 'Scoring Goals',
};

/** One mark per category, so a program has a picture beside its name: a ball, a bolt, a goal. */
const MARK: Record<string, string> = {
  'Technical': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8l3.6 2.6-1.4 4.2H9.8l-1.4-4.2L12 8ZM12 3v5M20.5 9.5l-4.9 1.1M17.5 19l-3.3-4.2M6.5 19l3.3-4.2M3.5 9.5l4.9 1.1',
  'Physical': 'M13 3 4 14h7l-1 7 9-11h-7l1-7Z',
  'Finishing & Crossing': 'M3 19V6h18v13M3 10.5h18M3 15h18M9 6v13M15 6v13',
};
function Mark({ cat, className }: { cat: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={MARK[cat]} /></svg>
  );
}

export default async function LibraryPage() {
  if (!(await libraryAllowed())) {
    // Their academy's own library, when their trainer lets them browse it.
    const own = await AcademyLibrary({});
    return own ? <div className="animate-pop">{own}</div> : <LibraryLocked title="Library" next="/library" />;
  }
  const [programs, sessions] = await Promise.all([getPrograms(), getSessions()]);
  const categories = ['Technical', 'Physical', 'Finishing & Crossing'];

  return (
    <div className="animate-pop">
      <BrandBand>
        <BandTag>Library</BandTag>
        <BandTitle>Pick a program</BandTitle>
      </BrandBand>

      <div className="stagger mt-9 space-y-9">
        {categories.map((cat) => {
          const inCat = programs.filter((p) => p.category === cat);
          if (!inCat.length) return null;
          return (
            <section key={cat}>
              <div className={`relative mb-4 flex items-center justify-between gap-4 overflow-hidden rounded-large-increased bg-gradient-to-br
                               ${ART[cat]} p-6 shadow-level3`}>
                <div>
                  <h2 className="font-brand text-headline font-extrabold leading-none
                                 tracking-brand-tight text-on-category">{KID[cat]}</h2>
                  <p className="mt-2 text-body font-semibold text-on-category opacity-80">
                    {inCat.length} {inCat.length === 1 ? 'program' : 'programs'}
                  </p>
                </div>
                <Mark cat={cat} className="h-14 w-14 shrink-0 text-on-category opacity-70" />
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
                      className="card pressable flex min-h-[76px] items-center gap-4 p-3">
                      <span className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${ART[cat]}`}>
                        <Mark cat={cat} className="h-6 w-6 text-on-category" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-title-sm font-bold leading-snug text-on-surface">{p.name}</div>
                        {/* No minute total. The number that helps is per drill, on
                            Train — "384m" against a program is not actionable. */}
                        <div className="mt-0.5 text-body font-semibold text-on-surface-variant">
                          {n} {n === 1 ? 'session' : 'sessions'}{LEVELS.has(p.level) ? ` · ${p.level}` : ''}
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
