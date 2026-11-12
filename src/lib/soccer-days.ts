const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Practice Tue, Thu · Game Sat", or null with nothing set. */
export function soccerLabel(club: number[], game: number | null) {
  const parts = [club.length ? `Practice ${club.map((d) => DAYS[d]).join(', ')}` : null, game !== null ? `Game ${DAYS[game]}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
