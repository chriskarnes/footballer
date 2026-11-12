import { getBranding } from '@/lib/branding-server';

/**
 * The academy's colours, edge to edge, at the top of a player page: the way
 * the marketing pages open, in the trainer's own brand. The wordmark sits in
 * it; whatever follows can overlap its lower edge (`overlap`), half in the
 * colour and half out.
 */
export async function BrandBand({ right, overlap = false, children }: {
  right?: React.ReactNode; overlap?: boolean; children: React.ReactNode;
}) {
  const brand = await getBranding();
  const name = brand?.name ?? 'Train.futbol';
  const dot = name.indexOf('.');
  const [head, tail] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  return (
    <section className={`relative isolate -mx-5 px-5 pt-4 text-on-surface-brand ${overlap ? 'pb-20' : 'pb-7'}`}>
      <div aria-hidden className="grain absolute bottom-0 left-[calc(50%_-_50dvw)] right-[calc(50%_-_50dvw)] -top-24 -z-10 overflow-hidden bg-surface-brand"
           style={{ backgroundImage: 'radial-gradient(70% 60% at 100% 0%, color-mix(in srgb, var(--app-brand-accent) 28%, transparent), transparent 70%)' }} />
      <header className="flex min-h-11 items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 font-brand text-[19px] tracking-tighter">
          {brand?.logo && <img src={brand.logo} alt="" className="h-8 w-8 rounded-lg object-contain" />}
          <span>
            <span className="font-extrabold">{head}</span>
            {tail && <span className="font-medium text-on-surface-brand-variant">{tail}</span>}
          </span>
        </span>
        {right && <span className="text-[12.5px] font-semibold text-on-surface-brand-variant">{right}</span>}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** The small accent label above a band headline: "Today", "Library". */
export function BandTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-md px-2.5 pb-1 pt-1.5 font-brand text-[11.5px] font-extrabold uppercase tracking-[.14em]"
          style={{ fontStretch: '140%', background: 'var(--app-brand-accent)', color: 'var(--app-brand-primary)' }}>
      {children}
    </span>
  );
}

/** A band headline, set like the marketing pages: wide, heavy, upper case. */
export function BandTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="site-wide mt-3 text-[28px] uppercase leading-[.95] [overflow-wrap:anywhere]">{children}</h1>;
}
