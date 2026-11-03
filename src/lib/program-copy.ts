/**
 * What the library says about a program, in the player's words.
 *
 * The `goal` column is text lifted from the source PDFs and is not fit to
 * show: it opens with a shouted heading ("90 DAY BALL MASTERY GOAL"), has
 * words run together where line breaks were ("overthe"), is a table of
 * contents for Finishing, and for Weak Foot is Elite Passer's goal pasted in.
 * No rule cleans all of that, so each program gets one line written here.
 * A program missing from this map shows no description rather than the raw one.
 */
export const PROGRAM_BLURBS: Record<string, string> = {
  '90-day-ball-mastery-program': 'Twelve weeks of ball control — juggling, dribbling, first touch and passing — stepping up every four weeks.',
  'beginner-program': 'The basics done properly: juggling, dribbling, passing and first touch.',
  'weak-foot-program': 'Turn your weaker foot into one you trust, over twelve weeks.',
  'advanced-dribbling-program': 'Keep the ball at speed and in tight spaces, and pick the right move under pressure.',
  'advanced-first-touch-program': 'Sharper first touches: scan, receive and move the ball where you want it.',
  'advanced-passer-program': 'Hit targets with both feet, receive and turn, and pass over every range.',
  'elite-dribbler-program': 'Total control in tight spaces, then changing direction and speed with the ball.',
  'elite-passer-program': 'Every pass a modern player needs, from short and sharp to long range.',
  'elite-first-touch': 'Control the ball out of the air — the hardest part of first touch.',
  'position-specific-program': 'Sessions built around what your position asks of you.',
  'at-home-program': 'Speed, strength and power work you can do at home with little or no kit.',
  'core-program': 'A strong, stable core for balance, shooting power and holding your ground.',
  'saq-program': 'Speed, agility and quickness: ladders, hurdles and footwork that carry onto the pitch.',
  'speed-kills-2-0': 'First-step quickness, acceleration and jumping power — the speed that wins the ball.',
  'crossing-program': 'The three crosses every wide player needs: standing, on the move, and out of a cut.',
  'advanced-crossing-program': 'Cross at game speed, with the timing and choices that turn wide play into chances.',
  'finishing-program': 'Finish from everywhere: finesse, back to goal, inside the box and from distance.',
};

/** Levels that tell a player something. "General" and "All Levels" do not. */
export const SHOWN_LEVELS = ['Beginner', 'Advanced', 'Elite', 'Position-Specific'];

/**
 * "Weeks 1-4 (Day 1) Ball Control + Juggling" → the schedule and the title,
 * apart. The schedule becomes a section heading and a label; the title is
 * what the card is called. Names without the pattern pass through untouched.
 */
export function splitSessionName(name: string): { weeks: string | null; day: number | null; title: string } {
  const m = name.match(/^Weeks?\s*(\d+)\s*-\s*(\d+)\s*\(Day\s*(\d+)\)\s*(.*)$/i);
  if (!m) return { weeks: null, day: null, title: name };
  const day = Number(m[3]);
  return { weeks: `Weeks ${m[1]}–${m[2]}`, day, title: m[4].trim() || `Day ${day}` };
}

/** 435 → "7 h 15 min"; 59 → "59 min". */
export function formatMinutes(total: number): string {
  const m = Math.round(total);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
