import { getBranding } from '@/lib/branding-server';

/**
 * The wordmark. Train.futbol is the name now — the `F` tile that used to sit
 * beside "Forge" is gone rather than re-lettered: a domain name reads as one
 * word, and a monogram in front of it makes the reader parse two marks.
 *
 * The weight break is the whole design. "Train" is the brand, ".futbol" is the
 * suffix, and setting the suffix at 500 in on-surface-variant is what stops it
 * reading as a shouted second word.
 *
 * A club's name from /admin takes the same treatment: anything after the first
 * dot is the suffix, so "Riverside.fc" sets like "Train.futbol" and "Riverside
 * FC" is one bold word. A logo, when there is one, sits in front.
 */
export async function Brand({ small }: { small?: boolean }) {
  const brand = await getBranding();
  const name = brand?.name ?? 'Train.futbol';
  const dot = name.indexOf('.');
  const [head, tail] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  const logo = brand?.logo;

  if (small) {
    return (
      <span className="flex items-center gap-2.5 font-brand text-[19px] tracking-tighter">
        {logo && <img src={logo} alt="" className="h-8 w-8 object-contain" />}
        <span>
          <span className="font-extrabold">{head}</span>
          {tail && <span className="font-medium text-on-surface-variant">{tail}</span>}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-4 rounded-[20px] bg-surface-brand border border-brand-edge px-6 py-4 shadow-level3">
      {logo && <img src={logo} alt="" className="h-11 w-11 object-contain" />}
      <span className="block font-brand text-[34px] leading-none tracking-tightest text-on-surface-brand">
        <span className="font-extrabold">{head}</span>
        {tail && <span className="font-medium text-on-surface-brand-variant">{tail}</span>}
      </span>
    </span>
  );
}
