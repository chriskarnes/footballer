/** The positions a player can pick, in the order they're offered. */
export const POSITIONS = [
  'Goalkeeper', 'Center back', 'Full back', 'Defensive mid',
  'Center mid', 'Attacking mid', 'Winger', 'Striker',
];

/**
 * A position as players see it. Answers saved before the names were spelled
 * out (GK, Centre-back) read as today's names, so the chip stays ticked.
 */
const OLD: Record<string, string> = {
  GK: 'Goalkeeper', 'Centre-back': 'Center back', 'Full-back': 'Full back', 'Centre mid': 'Center mid',
};
export const positionName = (p: string) => OLD[p] ?? p;
