/**
 * The wordmark. Train.futbol is the name now — the `F` tile that used to sit
 * beside "Forge" is gone rather than re-lettered: a domain name reads as one
 * word, and a monogram in front of it makes the reader parse two marks.
 *
 * The weight break is the whole design. "Train" is the brand, ".futbol" is the
 * suffix, and setting the suffix at 500 in on-surface-variant is what stops it
 * reading as a shouted second word.
 */
export function Brand({ small }: { small?: boolean }) {
  if (small) {
    return (
      <span className="font-brand text-[19px] tracking-tighter">
        <span className="font-extrabold">Train</span>
        <span className="font-medium text-on-surface-variant">.futbol</span>
      </span>
    );
  }
  return (
    <span className="inline-block rounded-[20px] bg-inverse-surface px-6 py-4 shadow-level3">
      <span className="block font-brand text-[34px] leading-none tracking-tightest text-inverse-primary">
        <span className="font-extrabold">Train</span>
        <span className="font-medium text-app-inverse-on-surface-variant">.futbol</span>
      </span>
    </span>
  );
}
