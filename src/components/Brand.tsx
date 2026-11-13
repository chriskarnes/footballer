import { getBranding } from '@/lib/branding-server';
import { Wordmark } from './Wordmark';

/**
 * The wordmark. Train.futbol is the name now — the `F` tile that used to sit
 * beside "Forge" is gone rather than re-lettered: a domain name reads as one
 * word, and a monogram in front of it makes the reader parse two marks.
 *
 * The weight break is the whole design. "Train" is the brand, ".futbol" is the
 * suffix, and setting the suffix at 500 in on-surface-variant is what stops it
 * reading as a shouted second word.
 *
 * A club's name from Brand settings takes the same treatment: anything after the first
 * dot is the suffix, so "Riverside.fc" sets like "Train.futbol" and "Riverside
 * FC" is one bold word. A logo, when there is one, sits in front.
 */
export async function Brand({ small }: { small?: boolean }) {
  const brand = await getBranding();
  const name = brand?.name ?? 'Train.futbol';
  if (small) return <Wordmark name={name} logo={brand?.logo} />;
  return (
    <span className="inline-flex rounded-[20px] border border-brand-edge bg-surface-brand px-6 py-4 text-on-surface-brand shadow-level3">
      <Wordmark name={name} logo={brand?.logo} size="lg" onBrand />
    </span>
  );
}
