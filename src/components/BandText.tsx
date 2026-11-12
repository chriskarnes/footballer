/**
 * The words in a brand band (see BrandBand). No server code here, so the
 * band's contents can be a client component, as Speed's is.
 */

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
  return <h1 className="site-wide mt-4 text-[34px] uppercase leading-[.95] [overflow-wrap:anywhere]">{children}</h1>;
}
