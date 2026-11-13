/**
 * A position as players see it. Answers saved before the names were spelled
 * out (GK, Centre-back) read as today's names, so the chip stays ticked.
 */
const OLD: Record<string, string> = {
  GK: 'Goalkeeper', 'Centre-back': 'Center back', 'Full-back': 'Full back', 'Centre mid': 'Center mid',
};
export const positionName = (p: string) => OLD[p] ?? p;
