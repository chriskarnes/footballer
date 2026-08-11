export function Brand({ small }: { small?: boolean }) {
  if (small) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-ink
                         font-display text-[13px] font-extrabold italic text-gold">F</span>
        <span className="font-display text-[15px] font-bold tracking-tighter">Forge</span>
      </span>
    );
  }
  return (
    <span className="inline-block rounded-[20px] bg-ink px-6 py-4 shadow-lift">
      <span className="block font-display text-[34px] font-extrabold italic leading-none
                       tracking-tightest text-gold">FORGE</span>
      <span className="mt-1.5 block text-[9.5px] font-bold tracking-[0.34em] text-white/80">
        ELITE ACCELERATOR
      </span>
    </span>
  );
}
