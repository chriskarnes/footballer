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

/** The age bands the profile form offers (ProfileSetup), as staff pages show them. */
export const AGE_LABEL: Record<string, string> = { u10: 'Under 10', '10_12': 'Age 10–12', '13_15': 'Age 13–15', '16_18': 'Age 16–17', '18_plus': '18+' };
