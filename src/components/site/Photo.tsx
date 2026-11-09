import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import { DuotoneVideo } from './DuotoneVideo';

/** Runs a box from screen edge to screen edge, whatever column it sits in. */
const BLEED = 'left-[calc(50%_-_50dvw)] right-[calc(50%_-_50dvw)]';

/**
 * A photo as two inks and grain, more poster than snapshot. `mint` for the
 * dark heroes (pitch-green shadows, mint highlights), `lime` for the loud
 * bands (pitch-green shadows, lime highlights). Fills its parent.
 */
export function Duotone({ photo, alt, position = '50% 50%', tone = 'mint', sizes, preload }: {
  photo: StaticImageData; alt: string; position?: string; tone?: 'mint' | 'lime'; sizes: string; preload?: boolean;
}) {
  return (
    <div className={`duotone grain absolute inset-0 ${tone === 'lime' ? 'duotone-lime' : ''}`}>
      <Image src={photo} alt={alt} fill preload={preload} sizes={sizes}
             className="object-cover" style={{ objectPosition: position }} />
    </div>
  );
}

/**
 * A row lifted straight from the app, worded exactly as the app words it:
 * `done` is a finished session in a player's week, `player` is a line on the
 * trainer's dashboard. `at` places it in the hero (wide screens only), clear
 * of the photo's subject.
 */
export type HeroCard = { at: React.CSSProperties; title: string; sub: string; kind: 'done' | 'player' };

/**
 * The top of every site page: deep green under the header, a duotone photo
 * bleeding off the right, and the green fading to paper below it, so each
 * page goes from dark to light. Without a photo it is the same dark top, for
 * forms.
 */
export function SiteHero({ photo, video, alt, position, cards = [], children }: {
  photo?: StaticImageData; alt?: string; position?: string; cards?: HeroCard[]; children: React.ReactNode;
  /** A short silent loop in place of the photo, with the same treatment. */
  video?: { src: string; poster: string };
}) {
  const media = photo || video;
  return (
    <section className={`site-dark relative isolate ${media ? 'pt-[250px] sm:pt-20' : 'pt-12 sm:pt-16'} pb-32 sm:pb-40`}>
      {/* The ground: green, a lime glow where the photo is, then paper. */}
      <div aria-hidden className={`absolute ${BLEED} -top-px bottom-0 -z-30`}
           style={{ background: [
             'radial-gradient(60% 55% at 78% 30%, rgba(200,240,60,.16), transparent 70%)',
             // Green all the way down to the paper: through moss and mint, never grey.
             'linear-gradient(to bottom, var(--site-ink) 0%, var(--site-pitch) 55%, #24503F 70%, #8DB8A2 84%, var(--site-mint) 93%, var(--site-paper) 100%)',
           ].join(', ') }} />

      {media && (
        <div className={`photo-hero-mask absolute ${BLEED} top-0 -z-20 h-[330px] sm:bottom-24 sm:left-[40%] sm:h-auto`}>
          {video
            ? <DuotoneVideo src={video.src} poster={video.poster} position={position} label={alt ?? ''} />
            : <Duotone photo={photo!} alt={alt ?? ''} position={position} preload sizes="(min-width: 640px) 70vw, 100vw" />}
        </div>
      )}

      {/* Little pieces of the app, pinned over the photo. */}
      {cards.map((c, i) => (
        <div key={i} aria-hidden className="pointer-events-none absolute z-10 hidden lg:block" style={c.at}>
          <Card c={c} />
        </div>
      ))}

      <div className="relative">{children}</div>
    </section>
  );
}

function Card({ c }: { c: HeroCard }) {
  return (
    <div className="flex w-[260px] -rotate-2 items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3
                    shadow-[0_6px_18px_-10px_rgba(0,0,0,.35)] backdrop-blur-md">
      {c.kind === 'done'
        ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-site-lime text-[14px] font-black text-site-ink">✓</span>
        : <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-site-lime" />}
      <span className="min-w-0">
        <span className={`block truncate text-[14px] font-bold text-white ${c.kind === 'done' ? 'line-through decoration-white/40' : ''}`}>{c.title}</span>
        <span className="block text-[12px] text-site-mint/80">{c.sub}</span>
      </span>
    </div>
  );
}

/** A headline word in lime. */
export function Lime({ children }: { children: React.ReactNode }) {
  return <span className="text-site-lime">{children}</span>;
}

/**
 * A loud photo band between light sections: lime duotone, a lime label, and
 * the line in wide type on a dark foot.
 */
export function PhotoBand({ photo, alt, position = '50% 50%', eyebrow, title, children }: {
  photo: StaticImageData; alt: string; position?: string; eyebrow: string; title: string; children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate mt-24 flex min-h-[420px] items-end overflow-hidden rounded-[28px] sm:min-h-[500px]">
      <div className="absolute inset-0 -z-10">
        <Duotone photo={photo} alt={alt} position={position} tone="lime" sizes="(min-width: 1024px) 64rem, 100vw" />
      </div>
      <div className="absolute inset-0 -z-10"
           style={{ background: 'linear-gradient(to top, rgba(7,29,23,.96) 0%, rgba(7,29,23,.75) 38%, rgba(7,29,23,0) 72%)' }} />
      <div className="max-w-[44rem] p-7 sm:p-10">
        <span className="marker">{eyebrow}</span>
        <h2 className="site-wide mt-4 text-[30px] uppercase leading-[.98] text-white sm:text-[48px]">{title}</h2>
        {children && <p className="mt-4 max-w-[34rem] text-[16px] leading-relaxed text-site-mint">{children}</p>}
      </div>
    </section>
  );
}

/** The closing ask: back to the dark, with one lime button. */
export function DarkCta({ title, children, href, cta }: {
  title: string; children: React.ReactNode; href: string; cta: string;
}) {
  return (
    <section className="relative isolate mt-24 overflow-hidden rounded-[28px] bg-site-ink px-7 py-12 sm:px-12 sm:py-16">
      <div aria-hidden className="absolute inset-0 -z-10"
           style={{ background: 'radial-gradient(70% 90% at 100% 0%, rgba(200,240,60,.18), transparent 60%)' }} />
      <h2 className="site-wide max-w-[16ch] text-[32px] uppercase leading-[.98] text-white sm:text-[46px]">{title}</h2>
      <p className="mt-4 max-w-[34rem] text-[16px] leading-relaxed text-site-mint">{children}</p>
      <Link href={href} className="btn-lime mt-8">{cta}</Link>
    </section>
  );
}
