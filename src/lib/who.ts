/** Whose email an account is: the player's own, or a parent's (migration 0009). */
export type Who = 'player' | 'parent';
export const isWho = (s: unknown): s is Who => s === 'player' || s === 'parent';
