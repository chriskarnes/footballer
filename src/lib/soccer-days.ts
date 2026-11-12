import type { TeamDays } from './academy-week';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const list = (ds: number[]) => [...ds].sort((a, b) => a - b).map((d) => DAYS[d]).join(', ');

/** "Trainer Mon · Practice Tue, Thu · Games Sat, Sun", or null with nothing set. */
export function soccerLabel({ trainer, practice, games }: TeamDays) {
  const parts = [
    trainer.length ? `Trainer ${list(trainer)}` : null,
    practice.length ? `Practice ${list(practice)}` : null,
    games.length ? `${games.length === 1 ? 'Game' : 'Games'} ${list(games)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
