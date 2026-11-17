/**
 * One player's standing, for their trainer (0040): on or off, and where
 * payment stands. Where families pay, that's Stripe's word. Where the
 * trainer collects their own way, it's the trainer's own note. Changing any
 * of it is in the menu beside the player's name.
 */
export function PlayerStatus({ first, active, mode, paid, paidOn, line, label }: {
  first: string; active: boolean;
  mode: 'trainer_pays' | 'players_pay' | 'none';
  paid: boolean; paidOn: string | null;
  /** Where a family's payments stand, in a sentence. */
  line: string | null;
  label: string;
}) {
  return (
    <section className="card mt-9 p-5 xl:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-card">
          {active ? 'Active' : (
            // In colour, as on the player list: the one state that should catch the eye.
            <span className="inline-block rounded-full border border-[#E8A0B4] bg-[#FCE4EC] px-3 py-0.5 text-[#9B1C45] dark:border-[#8E3A55] dark:bg-[#4A1F2D] dark:text-[#FFC2D4]">Inactive</span>
          )}
        </div>
        {label && active && <div className="text-body font-semibold text-on-surface-variant">{label}</div>}
      </div>
      <p className="mt-1 text-body leading-snug text-on-surface-variant">
        {active
          ? line ?? (mode === 'trainer_pays' ? `${first} counts toward what you pay.` : `${first} can open their training.`)
          : `${first} is still on your list with their history, but can’t open their training. ${mode === 'players_pay' ? 'Their family isn’t being charged.' : mode === 'trainer_pays' ? 'You aren’t charged for them.' : ''}`}
      </p>
      {mode === 'trainer_pays' && active && (
        <p className="mt-3 text-body-sm text-on-surface-variant">
          {paid ? `Marked as paid${paidOn ? ` on ${paidOn}` : ''}. ` : ''}“Paid” is your own note of who has paid you. It doesn’t change what {first} can open.
        </p>
      )}
      {mode === 'players_pay' && !active && (
        <p className="mt-3 text-body-sm text-on-surface-variant">Made active again, their family adds their card again to carry on.</p>
      )}
    </section>
  );
}
