import Link from 'next/link';

/**
 * The marketing site's frame: wordmark, two links and the one action, then
 * the page, then a quiet footer. Wider than the app (which is a phone column),
 * but each page still sets its own measure for text.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="safe-x flex min-h-dvh flex-col overflow-x-clip">
      {/* On the green: every page opens dark (see SiteHero). */}
      <div className="site-dark bg-site-ink">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 pb-2 pt-6 sm:px-8">
          <Link href="/" className="font-brand text-[20px] tracking-tighter text-white">
            <span className="font-extrabold">Train</span><span className="font-medium text-site-lime">.futbol</span>
          </Link>
          <nav className="flex items-center gap-5 text-[14px] font-semibold text-white/85">
            <Link href="/trainers" className="hidden hover:text-white sm:inline">Trainers</Link>
            <Link href="/players" className="hidden hover:text-white sm:inline">Players</Link>
            <Link href="/start" className="rounded-full bg-site-lime px-4 py-2 text-[13.5px] font-extrabold text-site-ink">Get started</Link>
          </nav>
        </header>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 sm:px-8">{children}</main>
      {/* And closes dark. */}
      <footer className="relative isolate mt-24 overflow-hidden bg-site-ink text-[13px] text-site-mint">
        <div className="mx-auto w-full max-w-5xl px-5 pb-6 pt-12 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>At-home training, set by your trainer.</span>
            <span className="flex gap-5">
              <Link href="/trainers" className="font-semibold text-white">Trainers</Link>
              <Link href="/players" className="font-semibold text-white">Players</Link>
              <Link href="/start" className="font-semibold text-white">Get started</Link>
            </span>
          </div>
          <div aria-hidden className="ghost-word mt-10 text-[15vw] sm:text-[124px]">TRAIN.FUTBOL</div>
        </div>
      </footer>
    </div>
  );
}

/** A section heading: small label, then the line that says it. */
export function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-[40rem]">
      <span className="marker mb-4">{eyebrow}</span>
      <h2 className="font-brand text-[30px] font-extrabold leading-[1.06] tracking-tighter text-site-ink sm:text-[38px]">{title}</h2>
      {children && <p className="mt-3 text-[16px] leading-relaxed text-on-surface-variant">{children}</p>}
    </div>
  );
}

/** A numbered step in a three-across row. */
export function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="card-flat relative overflow-hidden p-6">
      <span aria-hidden className="site-wide pointer-events-none absolute right-4 top-3 text-[64px] leading-none text-site-mint">{n}</span>
      <span className="relative font-brand text-[13px] font-extrabold uppercase tracking-[.14em] text-site-moss">Step {n}</span>
      <h3 className="h-card relative mt-2 text-on-surface">{title}</h3>
      <p className="relative mt-2 text-[14.5px] leading-relaxed text-on-surface-variant">{children}</p>
    </li>
  );
}
