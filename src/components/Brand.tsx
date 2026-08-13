export function Brand({ small }: { small?: boolean }) {
  if (small) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-inverse-surface
                         font-brand text-[13px] font-extrabold italic text-inverse-primary">F</span>
        <span className="font-brand text-[15px] font-bold tracking-tighter">Forge</span>
      </span>
    );
  }
  return (
    <span className="inline-block rounded-[20px] bg-inverse-surface px-6 py-4 shadow-level3">
      <span className="block font-brand text-[34px] font-extrabold italic leading-none
                       tracking-tightest text-inverse-primary">FORGE</span>
      <span className="mt-1.5 block text-[9.5px] font-bold tracking-[0.34em] text-forge-inverse-on-surface-variant">
        ELITE ACCELERATOR
      </span>
    </span>
  );
}
