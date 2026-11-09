import Image, { type StaticImageData } from 'next/image';

/**
 * A page's opening section over a photo. On a phone the photo runs edge to
 * edge across the top and fades down into the page, and the words start in
 * the fade. Wider, it sits to the right and bleeds off the edge, fading left
 * so the words never sit on a busy picture. The fade is a mask on the photo
 * (.photo-hero-mask in globals.css), so it suits either theme.
 */
export function PhotoHero({ photo, alt, position = '50% 40%', children }: {
  photo: StaticImageData; alt: string; position?: string; children: React.ReactNode;
}) {
  return (
    <section className="relative isolate pt-[230px] sm:min-h-[540px] sm:pb-16 sm:pt-24">
      <div className="photo-hero-mask absolute left-[calc(50%_-_50dvw)] right-[calc(50%_-_50dvw)] top-0 -z-10 h-[300px]
                      sm:bottom-0 sm:left-[42%] sm:h-auto">
        <Image src={photo} alt={alt} fill preload sizes="(min-width: 640px) 70vw, 100vw"
               className="object-cover" style={{ objectPosition: position }} />
        {/* A wash of the brand colour from the corner, so photos feel of a piece. */}
        <div className="absolute inset-0 mix-blend-multiply"
             style={{ background: 'linear-gradient(200deg, color-mix(in srgb, var(--md-sys-color-primary) 22%, transparent), transparent 60%)' }} />
      </div>
      {children}
    </section>
  );
}

/**
 * A photo with one line over it, between sections: dark at the foot so white
 * words read on any picture, in either theme.
 */
export function PhotoBand({ photo, alt, position = '50% 50%', eyebrow, title, children }: {
  photo: StaticImageData; alt: string; position?: string; eyebrow: string; title: string; children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate mt-24 flex min-h-[360px] items-end overflow-hidden rounded-[28px] sm:min-h-[440px]">
      <Image src={photo} alt={alt} fill placeholder="blur" sizes="(min-width: 1024px) 64rem, 100vw"
             className="-z-10 object-cover" style={{ objectPosition: position }} />
      <div className="absolute inset-0 -z-10"
           style={{ background: 'linear-gradient(to top, rgba(8,12,18,.9) 0%, rgba(8,12,18,.55) 40%, rgba(8,12,18,.05) 75%), linear-gradient(110deg, color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent), transparent 55%)' }} />
      <div className="max-w-[38rem] p-7 sm:p-10">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-white/75">{eyebrow}</p>
        <h2 className="font-brand text-[28px] font-extrabold leading-[1.1] tracking-tighter text-white sm:text-[38px]">{title}</h2>
        {children && <p className="mt-3 text-[16px] leading-relaxed text-white/85">{children}</p>}
      </div>
    </section>
  );
}
