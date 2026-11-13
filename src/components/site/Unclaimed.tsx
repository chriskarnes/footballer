/**
 * What an unclaimed subdomain shows. Most people who land here are a player
 * with a mistyped link, so that's the first door; the second is a trainer
 * who might want the name. The address itself is the headline, set on an empty pitch,
 * because "nobody's here yet" is the whole message.
 */
export function Unclaimed({ slug, root, rootLabel }: { slug: string; root: string; rootLabel: string }) {
  return (
    <div className="safe-x flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-3xl px-5 pt-6 sm:px-8">
        <a href={root} className="font-brand text-[20px] tracking-brand-snug text-on-surface">
          <span className="font-extrabold">Train</span><span className="font-medium text-on-surface-variant">.futbol</span>
        </a>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16 sm:px-8">
        <section className="mt-10 rounded-[28px] bg-surface-container-low px-6 pb-10 pt-8 sm:px-12 sm:pt-10">
          <Pitch />
          <div className="mt-8">
            <p className="eyebrow mb-4">Nobody&rsquo;s training here yet</p>
            <h1 className="break-words font-brand text-[34px] font-extrabold leading-[1.05] tracking-brand-tight text-on-surface sm:text-[52px]">
              {slug}<span className="font-medium text-on-surface-variant">.{rootLabel}</span>
            </h1>
            <p className="mt-4 max-w-[30rem] text-[16px] leading-relaxed text-on-surface-variant sm:text-[17px]">
              This address doesn&rsquo;t belong to a trainer yet. Are you a player or a trainer?
            </p>
          </div>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="card flex flex-col p-6">
            <span className="eyebrow">I&rsquo;m a player or parent</span>
            <h2 className="h-card mt-3 text-on-surface">The link may be wrong</h2>
            <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-on-surface-variant">
              Check the address your trainer sent you. One wrong letter brings you here. You can also search for your trainer by name.
            </p>
            <a href={`${root}/players`} className="btn-primary pressable mt-5 w-full">Find my trainer</a>
          </div>
          <div className="card flex flex-col p-6">
            <span className="eyebrow">I&rsquo;m a trainer</span>
            <h2 className="h-card mt-3 text-on-surface">This address is available</h2>
            <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-on-surface-variant">
              Make it your page. Your players will open <b className="text-on-surface">{slug}.{rootLabel}</b> and see your sessions.
            </p>
            <a href={`${root}/start?slug=${encodeURIComponent(slug)}`} className="btn-ghost pressable mt-5 w-full">Claim this address</a>
          </div>
        </div>
      </main>
    </div>
  );
}

/** An empty pitch, top down: nobody on it. */
function Pitch() {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 220" className="block h-auto w-full max-w-[22rem] text-outline"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="4" y="4" width="392" height="212" rx="6" />
      <line x1="200" y1="4" x2="200" y2="216" />
      <circle cx="200" cy="110" r="34" />
      <circle cx="200" cy="110" r="3" fill="currentColor" />
      <rect x="4" y="54" width="62" height="112" />
      <rect x="4" y="84" width="24" height="52" />
      <path d="M66 88 a 26 26 0 0 1 0 44" />
      <rect x="334" y="54" width="62" height="112" />
      <rect x="372" y="84" width="24" height="52" />
      <path d="M334 88 a 26 26 0 0 0 0 44" />
    </svg>
  );
}
