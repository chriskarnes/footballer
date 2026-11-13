/**
 * The academy's mark: its logo, if any, then its name, with anything after
 * the first dot as a quieter suffix ("Train" + ".futbol"). The one way it's
 * drawn: app bars, the brand band, the join and claim pages, and the
 * branding preview all use this, so the preview is what players see.
 *
 * No server code, so the branding screen can draw it live. Colours come from
 * the surroundings: `onBrand` for the brand band, the page's otherwise.
 */
export function Wordmark({ name, logo, size = 'sm', onBrand = false }: {
  name: string; logo?: string | null; size?: 'sm' | 'lg'; onBrand?: boolean;
}) {
  const dot = name.indexOf('.');
  const [head, tail] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  const quiet = onBrand ? 'text-on-surface-brand-variant' : 'text-on-surface-variant';
  const lg = size === 'lg';
  return (
    <span className={`flex items-center font-brand ${lg ? 'gap-4 text-headline-lg leading-none tracking-brand-tight' : 'gap-2.5 text-title-lg tracking-brand-snug'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo && <img src={logo} alt="" className={`${lg ? 'h-11 w-11 rounded-medium' : 'h-8 w-8 rounded-small'} shrink-0 object-contain`} />}
      <span className="min-w-0">
        <span className="font-extrabold">{head}</span>
        {tail && <span className={`font-medium ${quiet}`}>{tail}</span>}
      </span>
    </span>
  );
}
