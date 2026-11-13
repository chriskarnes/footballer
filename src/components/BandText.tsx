/**
 * The words in a brand band (see BrandBand). No server code here, so the
 * band's contents can be a client component, as Speed's is.
 */

/** The small accent label above a band headline: "Today", "Library". */
export function BandTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-small px-2.5 pb-1 pt-1.5 font-brand text-caption font-extrabold uppercase tracking-[.14em] accent-badge"
          style={{ fontStretch: '140%' }}>
      {children}
    </span>
  );
}

/** A band headline, set like the marketing pages: wide, heavy, upper case. */
export function BandTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="site-wide mt-4 text-headline-lg uppercase leading-[.95] [overflow-wrap:anywhere]">{children}</h1>;
}
