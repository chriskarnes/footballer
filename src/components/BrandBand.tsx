import { getBranding } from '@/lib/branding-server';
import { Wordmark } from './Wordmark';

/**
 * The academy's colours, edge to edge, at the top of a player page: the way
 * the marketing pages open, in the trainer's own brand. The wordmark sits in
 * it; whatever follows can overlap its lower edge (`overlap`), half in the
 * colour and half out.
 */
export async function BrandBand({ right, overlap = false, compact = false, name, children }: {
  right?: React.ReactNode; overlap?: boolean;
  /** The name in the header, where it isn't this academy's branding yet (claiming it). */
  name?: string;
  /** Less air above and below: Train's band, which has to leave room for the week under it. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  const brand = await getBranding();
  return (
    <section className={`relative isolate -mx-5 px-5 pt-4 text-on-surface-brand ${overlap ? 'pb-20' : compact ? 'pb-5' : 'pb-9'}`}>
      <div aria-hidden className="grain absolute bottom-0 left-[calc(50%_-_50dvw)] right-[calc(50%_-_50dvw)] -top-24 -z-10 overflow-hidden bg-surface-brand"
           style={{ backgroundImage: 'radial-gradient(70% 60% at 100% 0%, color-mix(in srgb, var(--app-brand-accent) 28%, transparent), transparent 70%)' }} />
      <header className="flex min-h-11 items-center justify-between gap-3">
        <Wordmark name={name ?? brand?.name ?? 'Train.futbol'} logo={name ? null : brand?.logo} onBrand />
        {right && <span className="text-[12.5px] font-semibold text-on-surface-brand-variant">{right}</span>}
      </header>
      <div className={compact ? 'mt-4' : 'mt-9'}>{children}</div>
    </section>
  );
}

// Plain markup, in their own file so client components can use them too.
export { BandTag, BandTitle } from './BandText';
