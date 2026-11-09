import Link from 'next/link';

/**
 * The marketing site's frame: wordmark, two links and the one action, then
 * the page, then a quiet footer. Wider than the app (which is a phone column),
 * but each page still sets its own measure for text.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="safe-x flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 pb-2 pt-6 sm:px-8">
        <Link href="/" className="font-brand text-[20px] tracking-tighter text-on-surface">
          <span className="font-extrabold">Train</span><span className="font-medium text-on-surface-variant">.futbol</span>
        </Link>
        <nav className="flex items-center gap-5 text-[14px] font-semibold text-on-surface">
          <Link href="/players" className="hidden sm:inline">Players</Link>
          <Link href="/coaches" className="hidden sm:inline">Coaches</Link>
          <Link href="/start" className="btn-ghost btn-sm pressable">Get started</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 sm:px-8">{children}</main>
      <footer className="mx-auto mt-24 w-full max-w-5xl border-t border-outline-variant px-5 py-8 text-[13px] text-on-surface-variant sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>Train.futbol: at-home training, set by your coach.</span>
          <span className="flex gap-5">
            <Link href="/players" className="font-semibold text-on-surface">Players</Link>
            <Link href="/coaches" className="font-semibold text-on-surface">Coaches</Link>
            <Link href="/start" className="font-semibold text-on-surface">Get started</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** A section heading: small label, then the line that says it. */
export function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-[40rem]">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h2 className="font-brand text-[28px] font-extrabold leading-[1.1] tracking-tighter text-on-surface sm:text-[34px]">{title}</h2>
      {children && <p className="mt-3 text-[16px] leading-relaxed text-on-surface-variant">{children}</p>}
    </div>
  );
}

/** A numbered step in a three-across row. */
export function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="card-flat p-6">
      <span className="font-brand text-[15px] font-extrabold text-on-surface-variant">{n}</span>
      <h3 className="h-card mt-2 text-on-surface">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-on-surface-variant">{children}</p>
    </li>
  );
}
