/**
 * Kestrel Soccer Training: a whole made-up training group, for showing the
 * app to trainers. Its own academy (kestrel.train.futbol), its own crest and
 * colours, 50 drills, 18 sessions, 5 programs, 4 groups and 17 players with
 * five weeks of history.
 *
 *   npm run seed:kestrel -- --owner you+kestrel@example.com --player you+leo@example.com
 *   npm run seed:kestrel            # after the first run: resets it for today
 *
 * --owner  the trainer's sign-in (first run only; the academy keeps its owner).
 * --player optional: a player you can sign in as (Leo Marsh, in U12 Technical).
 *          Use a fresh address. Without it Leo is a sample account like the rest.
 *
 * Everything in it is written for this file. Nothing comes from the licensed
 * library, and the academy's library_access stays off, so it is safe to show
 * to anyone. It is unlisted: it doesn't appear in Find your trainer.
 *
 * History is worked out from today, with the app's own week logic, so "this
 * week" is this week: re-run it the morning of a demo. A re-run puts the
 * academy back exactly as written here. Drills, sessions, programs, groups
 * and notes made in it by hand are removed; its members and their sign-ins
 * stay. It only ever touches an academy it made itself.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildWeek, setItems, teamDays, type CustomRow, type DrillRow, type GroupRow, type PlayerProgramRow, type ProgramRow, type ScheduleRow, type SessionRow } from '../src/lib/academy-week';
import { buildPlayerWeek, type Feel, type PastWeek } from '../src/lib/week-builder';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const OWNER_EMAIL = arg('owner')?.toLowerCase();
const PLAYER_EMAIL = arg('player')?.toLowerCase();

const ACADEMY = {
  slug: 'kestrel', name: 'Kestrel Soccer Training', time_zone: 'America/New_York',
  palette_id: 'claret', primary_color: '#6E1A37', accent_color: '#8EC5EC',
};
const TRAINER_NAME = 'Matt Reyes';
/** The player the --player address signs in as. */
const LOGIN_PLAYER = 'Leo Marsh';
const TZ = ACADEMY.time_zone;

// ------------------------------------------------------------- content ---
type Drill = { key: string; name: string; amount: string; minutes: number; tags: string[]; how: string; harder?: string };

const DRILLS: Drill[] = [
  // Ball mastery
  { key: 'taps', name: 'Toe taps', amount: '3 × 40 sec', minutes: 4, tags: ['ball_mastery'],
    how: 'Ball still in front of you. Tap the top with the sole of each foot in turn, like running on the spot.\nStay on the balls of your feet, knees soft.\nRound 3: eyes up. Read something across the yard while you tap.' },
  { key: 'ticktock', name: 'Tick-tocks', amount: '3 × 40 sec', minutes: 4, tags: ['ball_mastery'],
    how: 'Knock the ball between the insides of your feet, right-left-right.\nSmall touches, ball never wider than your shoulders.\nStart on the spot, then travel forward five yards and back.' },
  { key: 'solerolls', name: 'Sole rolls, side to side', amount: '3 × 30 sec each foot', minutes: 5, tags: ['ball_mastery'],
    how: 'Roll the ball across your body with the sole, stop it with the inside of the other foot.\nRoll it back the same way.\nKeep your hips facing forward: the ball moves, you don\'t turn.' },
  { key: 'vpull', name: 'V-pulls', amount: '3 × 12 each foot', minutes: 5, tags: ['ball_mastery', 'weak_foot'], harder: 'lturn',
    how: 'Push the ball out in front. Pull it back with the sole.\nPush it out at an angle with the inside of the same foot, so the ball draws a V.\nOne foot for the whole set, then swap. Count the weak foot honestly.' },
  { key: 'lturn', name: 'Pull-push L-turns', amount: '3 × 10 each foot', minutes: 6, tags: ['ball_mastery', 'dribbling'],
    how: 'Pull the ball back with the sole, then push it behind your standing leg with the inside of the same foot.\nTurn and take it away in the new direction with your other foot.\nThree quick steps out of every turn. The turn is only half of it.' },
  { key: 'insideout', name: 'Inside-outside touches', amount: '3 × 20 each foot', minutes: 5, tags: ['ball_mastery', 'dribbling'],
    how: 'One foot only. Touch the ball in with the inside, out with the outside, moving forward.\nA touch on every step.\nGo ten yards out on the right foot, come back on the left.' },
  { key: 'triangle', name: 'Triangle touches', amount: '4 × 45 sec', minutes: 6, tags: ['ball_mastery'],
    how: 'Pull the ball back with the sole of your right foot.\nPass it across with the inside of the right, then push it forward with the inside of the left.\nThat is one triangle. Do a set, then go the other way round.' },
  { key: 'box', name: 'Four-cone mastery box', amount: '3 rounds', minutes: 8, tags: ['ball_mastery', 'agility'],
    how: 'Four cones in a square, four yards a side.\nSide one: tick-tocks. Side two: sole rolls. Side three: inside-outside. Side four: toe taps backwards.\nOne lap is one round. Rest 30 seconds between rounds, then go the other way.' },

  // Dribbling
  { key: 'slalom', name: 'Tight slalom, one foot only', amount: '6 runs each foot', minutes: 6, tags: ['dribbling', 'weak_foot'],
    how: 'Six cones in a line, one big step apart.\nWeave through using one foot only: inside, outside, inside.\nJog back round the outside. Weak-foot runs count double in your head.' },
  { key: 'gates', name: 'Gate dribbling', amount: '4 × 60 sec', minutes: 7, tags: ['dribbling', 'agility'],
    how: 'Scatter six gates (two cones a yard apart) around a ten-yard area.\nDribble through as many as you can in the time. Never the same gate twice in a row.\nCount your gates and beat the number next round.' },
  { key: 'scissor', name: 'Scissor and go', amount: '3 × 8 each side', minutes: 6, tags: ['dribbling'], harder: 'doublescissor',
    how: 'Dribble at a cone at jogging pace.\nTwo yards out, step around the front of the ball with one foot, then take it away with the outside of the other.\nSell it: drop your shoulder the way you are not going.' },
  { key: 'doublescissor', name: 'Double scissor, explode out', amount: '3 × 8 each side', minutes: 7, tags: ['dribbling', 'speed'],
    how: 'Same as scissor and go, but step around the ball with one foot, then the other, before you take it away.\nThe exit touch goes five yards. Sprint on to it.\nIf the ball gets stuck under you, slow the feet down and start again.' },
  { key: 'cuts', name: 'Stop-start cuts', amount: '3 × 10 each foot', minutes: 6, tags: ['dribbling', 'agility'],
    how: 'Two cones eight yards apart. Dribble to the cone and cut back with the inside of your foot.\nNext set, cut with the outside. Last set, stop it dead with the sole and go.\nGet low into the cut. Speed out of it is the whole point.' },
  { key: 'turnsquare', name: 'Turn square', amount: '4 laps each way', minutes: 7, tags: ['dribbling', 'first_touch'],
    how: 'Four cones in a square, six yards a side. A different turn at each cone:\ninside hook, outside hook, drag-back, and the turn behind your standing leg.\nNo extra touches between the turn and the next cone.' },
  { key: 'shadow', name: 'Shadow defender moves', amount: '12 attacks', minutes: 8, tags: ['dribbling'],
    how: 'Put a cone, a bag or a chair down as the defender.\nAttack it from ten yards. Make your move two yards out, never closer.\nMix them up: a scissor, a body feint, a chop. Finish every attack with a five-yard burst.' },
  { key: 'speeddribble', name: 'Speed dribble and brake', amount: '8 runs', minutes: 6, tags: ['dribbling', 'speed'],
    how: 'Mark out 20 yards. Push the ball with your laces, a touch every third step, as fast as you can keep it.\nStop it dead on the line with your sole.\nWalk back. Each run should be faster than the last.' },

  // First touch
  { key: 'wall2', name: 'Two-touch wall work', amount: '3 × 30 each foot', minutes: 6, tags: ['first_touch', 'passing'],
    how: 'Stand four yards from a wall.\nFirst touch sets the ball half a yard out of your feet. Second touch passes.\nReceive on your back foot. If the first touch is right, you don\'t have to reach for the second.' },
  { key: 'openup', name: 'Open up on the back foot', amount: '3 × 12 each side', minutes: 6, tags: ['first_touch'],
    how: 'Pass against the wall and stand side-on as the ball comes back.\nLet it run across your body and take it with the far foot, so you finish facing the other way.\nPass back in with your second touch. Then the other side.' },
  { key: 'checkturn', name: 'Check your shoulder, turn out', amount: '3 × 10 each way', minutes: 7, tags: ['first_touch', 'agility'], harder: 'wallturn',
    how: 'Put a cone five yards behind you. Pass against the wall.\nWhile the ball is travelling, look over your shoulder at the cone.\nTurn with your first touch and dribble to it. Jog back and go again, turning the other way.' },
  { key: 'wallturn', name: 'Wall bounce, turn and drive', amount: '3 × 10 each way', minutes: 8, tags: ['first_touch', 'dribbling'],
    how: 'Hit the wall firmly from six yards so the ball comes back with pace.\nLook over your shoulder, turn with one touch, and drive ten yards at speed.\nUse the outside of the foot one way and the inside the other.' },
  { key: 'air', name: 'Cushion it from the air', amount: '3 × 15', minutes: 6, tags: ['first_touch', 'juggling'],
    how: 'Throw the ball above your head.\nBring it down dead with your foot, then your thigh, then your chest, one set of each.\nThe ball should drop within one step of you. Give with the touch, like catching an egg.' },
  { key: 'gatetouch', name: 'First touch through the gate', amount: '4 × 10', minutes: 7, tags: ['first_touch'],
    how: 'Make a gate two yards wide, a yard to one side of you.\nPass against the wall. Your first touch takes the ball through the gate, and you follow it.\nMove the gate to the other side each set, and further away when it feels easy.' },

  // Passing
  { key: 'wall1', name: 'One-touch wall passes', amount: '3 × 40 each foot', minutes: 6, tags: ['passing', 'weak_foot'],
    how: 'Three yards from the wall. One touch, inside of the foot, every time.\nLock your ankle, toes up, and strike the middle of the ball.\nOn your toes between passes. Flat feet are why the next one goes wrong.' },
  { key: 'targets', name: 'Target passing, three distances', amount: '30 passes each foot', minutes: 7, tags: ['passing'],
    how: 'Mark a target a yard wide on the wall, or use two cones.\nTen passes from five yards, ten from ten, ten from fifteen.\nIt only counts if it hits the target along the ground.' },
  { key: 'driven', name: 'Driven pass with the laces', amount: '3 × 12 each foot', minutes: 7, tags: ['passing', 'power'],
    how: 'Fifteen yards from the wall or a partner.\nStanding foot beside the ball, knee over it, strike through the middle with your laces.\nThe ball should stay below knee height. If it lifts, you are leaning back.' },
  { key: 'chip', name: 'Chip on to a target', amount: '20 each foot', minutes: 7, tags: ['passing'],
    how: 'Lay a towel or a bib on the ground 15 to 20 yards away.\nGet your toes under the ball and stab down, so it lifts with backspin and stops.\nScore yourself: three points on the towel, one within a step of it.' },
  { key: 'passmove', name: 'Pass and move triangle', amount: '4 × 60 sec', minutes: 7, tags: ['passing', 'first_touch'],
    how: 'Two cones five yards apart, five yards from the wall.\nPass from the first cone, sprint to the second, and receive there. Then pass and sprint back.\nTwo touches for the first two rounds, one touch for the last two.' },
  { key: 'weakonly', name: 'Weak foot only: pass and receive', amount: '100 passes', minutes: 6, tags: ['weak_foot', 'passing'],
    how: 'Against a wall from four yards. Your strong foot is not allowed to touch the ball.\nTwo touches until it feels normal, then one.\nCount to 100. Start again from zero if the strong foot sneaks in.' },

  // Juggling
  { key: 'bounce', name: 'One-bounce juggling', amount: 'Best of 10 tries', minutes: 5, tags: ['juggling'],
    how: 'Drop the ball, let it bounce once, and kick it up to waist height with your laces.\nLet it bounce, and go again with the other foot.\nCount the kicks in a row and write down your best.' },
  { key: 'feetonly', name: 'Feet-only juggling', amount: 'Best of 10 tries', minutes: 5, tags: ['juggling'],
    how: 'No bounce. Laces only, the ball no higher than your waist.\nToes pointed, ankle locked, a little backspin.\nWrite your best down. Beat it by one next time.' },
  { key: 'weakjuggle', name: 'Weak foot juggling', amount: '3 × 15 in a row', minutes: 5, tags: ['juggling', 'weak_foot'],
    how: 'Weak foot only. A bounce in between is fine to begin with.\nKeep the ball low: knee height is plenty.\nWhen 15 with a bounce is easy, take the bounce away.' },
  { key: 'upthebody', name: 'Up the body: foot, thigh, head', amount: '10 clean rounds', minutes: 6, tags: ['juggling', 'first_touch'],
    how: 'Foot, thigh, head, then catch it. That is one round.\nNext: foot, thigh, head, thigh, foot, without a catch.\nSmall touches. You are placing the ball, not kicking it.' },

  // Finishing
  { key: 'corners', name: 'Bottom corners, inside of the foot', amount: '3 × 10 each foot', minutes: 8, tags: ['finishing'],
    how: 'Put a cone a yard inside each post. From 12 yards, pass the ball into the gap between cone and post.\nOpen your body and follow through at the corner.\nPlacement, not power. Keep score out of ten.' },
  { key: 'laces', name: 'Laces through the ball', amount: '3 × 8 each foot', minutes: 8, tags: ['finishing', 'power'],
    how: 'From the edge of the box, or 16 yards from a wall.\nA slight angle on your run-up, standing foot beside the ball, head over it.\nLand on your shooting foot. If you land on the other one, you leaned back.' },
  { key: 'touchshoot', name: 'Touch, set, shoot', amount: '3 × 8 each side', minutes: 8, tags: ['finishing', 'first_touch'],
    how: 'Start with your back to goal, 18 yards out, the ball at your feet.\nTouch it out of your feet to one side and shoot with your next touch.\nTwo touches, no more. The first one decides how good the shot is.' },
  { key: 'turnfinish', name: 'Back to goal, turn and finish', amount: '3 × 6 each way', minutes: 8, tags: ['finishing'],
    how: 'Pass against a wall or a rebounder with your back to goal, 14 yards out.\nTurn with your first touch and shoot with your second.\nTurn both ways. Pick your corner before the ball arrives.' },
  { key: 'cutfinish', name: 'Beat the cone, finish', amount: '16 finishes', minutes: 9, tags: ['finishing', 'dribbling'],
    how: 'A cone on the edge of the box as the defender. Start 25 yards out.\nDribble at it, make your move, and shoot inside two touches after it.\nEight going right, eight going left. Finish across the goal.' },
  { key: 'volleys', name: 'Self-fed volleys', amount: '3 × 8 each foot', minutes: 7, tags: ['finishing'],
    how: 'Drop the ball from your hands and strike it before it lands, then after one bounce.\nKnee over the ball, toes down, and keep it below head height.\nA clean strike low into the net beats a hard one over the bar.' },
  { key: 'weakfinish', name: 'Weak foot finishing', amount: '30 shots', minutes: 8, tags: ['finishing', 'weak_foot'],
    how: 'Ten from 8 yards, ten from 12, ten from 16. Weak foot only.\nInside of the foot from close in, laces from further out.\nIt will feel wrong for the first ten. That is the point of the other twenty.' },

  // Crossing
  { key: 'whip', name: 'Whipped cross to a zone', amount: '3 × 6 each side', minutes: 8, tags: ['crossing'],
    how: 'Mark a zone between the penalty spot and the six-yard line.\nDribble down the wing at pace, push the ball out of your feet, and cross on the run.\nWrap your foot around the ball so it curls away from the keeper.' },
  { key: 'cutback', name: 'Byline cut-back', amount: '3 × 6 each side', minutes: 7, tags: ['crossing', 'passing'],
    how: 'Drive to the byline beside the box.\nLook up, then pull the ball back along the ground to a cone on the penalty spot.\nFirm, and on the floor. Every bounce makes the finish harder.' },

  // Speed, agility, strength
  { key: 'quickfeet', name: 'Line hops and quick feet', amount: '4 × 20 sec', minutes: 5, tags: ['agility'],
    how: 'Use any line on the ground.\nRound one: two feet side to side over it. Two: forward and back. Three and four: one foot each.\nQuiet feet. If you can hear them slap, you are too heavy on the ground.' },
  { key: 'accel', name: '10-yard accelerations', amount: '8 sprints', minutes: 6, tags: ['speed'],
    how: 'Start from a different position each time: standing, side-on, facing backwards, lying down.\nShort fast steps for the first three, body leaning forward.\nWalk back and take a full rest. These only work at full speed.' },
  { key: 'shuttle', name: '5-10-5 shuttle', amount: '6 runs', minutes: 6, tags: ['agility', 'speed'],
    how: 'Three cones in a line, five yards apart. Start at the middle one.\nSprint to one end, touch the line, sprint to the far end, touch, and back through the middle.\nSit low into each turn and push off the outside foot. Lead with a different side each run.' },
  { key: 'tdrill', name: 'T-drill with the ball', amount: '6 runs', minutes: 7, tags: ['agility', 'dribbling'],
    how: 'Cones in a T: ten yards up, five yards out to each side.\nDribble up, cut left, cut all the way across to the right, back to the middle, and home.\nThe ball stays within a step of you the whole way. Time it if you can.' },
  { key: 'legs', name: 'Single-leg strength circuit', amount: '3 × 8 each leg', minutes: 8, tags: ['strength'],
    how: 'Split squats, single-leg hip hinges and single-leg calf raises: a set of each on one leg, then the other.\nSlow on the way down, two seconds.\nNo weights needed. Stop a set when the knee starts to wobble.' },
  { key: 'core', name: 'Core four', amount: '3 × 30 sec each', minutes: 6, tags: ['core'],
    how: 'Front plank, side plank left, side plank right, dead bug.\nStraight line from head to heel. Squeeze your glutes.\nIf your hips drop, stop the clock: shorter and straight is better.' },
  { key: 'warmup', name: 'Dynamic warm-up', amount: '2 lengths each move', minutes: 5, tags: ['mobility'],
    how: 'Over ten yards: jog, side shuffle, high knees, heel flicks, open the gate, close the gate.\nThen leg swings, ten on each leg.\nFinish with two runs at three-quarter pace. You should be warm, not tired.' },
  { key: 'cooldown', name: 'Cool-down stretch', amount: '30 sec each stretch', minutes: 5, tags: ['mobility'],
    how: 'Walk for a minute first.\nThen calves, hamstrings, quads, hip flexors and groin, both sides.\nBreathe out into each stretch. Nothing should hurt.' },
  { key: 'ballshuttles', name: 'Ball shuttles', amount: '6 × 45 sec', minutes: 8, tags: ['conditioning', 'dribbling'],
    how: 'Cones at 5, 10 and 15 yards.\nDribble to the first and back, the second and back, the third and back, and keep going until the time is up.\nTurn a different way at every cone. Rest 30 seconds between rounds.' },
];

/** The session library: name → drills, in order. About 30 to 36 minutes each. */
const SESSIONS: Record<string, { name: string; drills: string[] }> = {
  bm1: { name: 'Ball Mastery 1: Soles and Toes', drills: ['warmup', 'taps', 'ticktock', 'solerolls', 'insideout', 'bounce', 'cooldown'] },
  bm2: { name: 'Ball Mastery 2: Pulls and Turns', drills: ['warmup', 'ticktock', 'vpull', 'triangle', 'cuts', 'feetonly'] },
  bm3: { name: 'Ball Mastery 3: The Box', drills: ['warmup', 'taps', 'lturn', 'box', 'slalom', 'feetonly'] },
  close: { name: 'Close Control', drills: ['warmup', 'insideout', 'slalom', 'gates', 'cuts', 'bounce'] },
  moves: { name: '1v1 Moves', drills: ['warmup', 'taps', 'scissor', 'turnsquare', 'shadow', 'speeddribble'] },
  beat: { name: 'Beat Your Defender', drills: ['warmup', 'doublescissor', 'cuts', 'shadow', 'cutfinish'] },
  ft1: { name: 'First Touch 1: Wall Work', drills: ['warmup', 'wall2', 'openup', 'wall1', 'air', 'feetonly'] },
  ft2: { name: 'First Touch 2: Receive and Turn', drills: ['warmup', 'openup', 'checkturn', 'gatetouch', 'passmove'] },
  range: { name: 'Passing Range', drills: ['warmup', 'wall1', 'targets', 'driven', 'chip'] },
  weak: { name: 'Weak Foot Day', drills: ['warmup', 'weakonly', 'vpull', 'slalom', 'weakjuggle', 'weakfinish'] },
  fin1: { name: 'Finishing 1: Placement', drills: ['warmup', 'wall2', 'corners', 'touchshoot', 'weakfinish'] },
  fin2: { name: 'Finishing 2: Power and Volleys', drills: ['warmup', 'driven', 'laces', 'volleys', 'turnfinish'] },
  fin3: { name: 'Finishing 3: Game Finishes', drills: ['warmup', 'scissor', 'turnfinish', 'cutfinish', 'touchshoot'] },
  wide: { name: 'Wide Play: Crossing', drills: ['warmup', 'speeddribble', 'whip', 'cutback', 'chip'] },
  speed: { name: 'Quick Feet and Speed', drills: ['warmup', 'quickfeet', 'accel', 'shuttle', 'tdrill', 'cooldown'] },
  strength: { name: 'Strength and Core', drills: ['warmup', 'legs', 'core', 'ballshuttles', 'cooldown'] },
  juggle: { name: 'Juggling Challenge', drills: ['bounce', 'feetonly', 'weakjuggle', 'upthebody', 'air', 'taps'] },
  light: { name: 'Day Before a Game: Light Touches', drills: ['warmup', 'ticktock', 'wall2', 'wall1', 'feetonly', 'cooldown'] },
};

/** Programs: each week's sessions, by library key. A week left out repeats the one before. */
const PROGRAMS: Record<string, { name: string; weeks: number; description: string; plan: Record<number, string[]> }> = {
  foundations: {
    name: 'Ball Mastery Foundations', weeks: 6,
    description: 'Two short sessions a week for younger players: a touch on every step, both feet, and the first turns. By week six the ball stays within reach at a jog.',
    plan: { 1: ['bm1', 'bm2'], 2: ['bm1', 'close'], 3: ['bm2', 'bm3'], 4: ['bm3', 'close'], 5: ['bm3', 'juggle'], 6: ['close', 'weak'] },
  },
  touch: {
    name: 'First Touch and Passing', weeks: 6,
    description: 'Wall work first, then receiving on the half-turn, then range. Two sessions a week between team practices. All of it can be done alone with a wall.',
    plan: { 1: ['ft1', 'range'], 2: ['ft1', 'ft2'], 3: ['ft2', 'range'], 4: ['ft2', 'weak'], 5: ['range', 'wide'], 6: ['ft2', 'light'] },
  },
  attacker: {
    name: "Attacker's Edge: 1v1 and Finishing", weeks: 8,
    description: 'Three sessions a week for forwards and wingers: moves to beat a defender, then finishing off them, with weak-foot and wide play alongside. Placement before power.',
    plan: {
      1: ['moves', 'fin1', 'weak'], 2: ['moves', 'fin1', 'wide'], 3: ['beat', 'fin2', 'weak'], 4: ['beat', 'fin2', 'wide'],
      5: ['moves', 'fin3', 'juggle'], 6: ['beat', 'fin3', 'wide'], 7: ['beat', 'fin3', 'weak'], 8: ['fin3', 'wide', 'light'],
    },
  },
  athlete: {
    name: 'Speed, Strength and Agility', weeks: 4,
    description: 'The athletic side: acceleration, change of direction, and single-leg strength. Two sessions a week, no gym needed.',
    plan: { 1: ['speed', 'strength'] },
  },
  winter: {
    name: 'Winter Break Touches', weeks: 3,
    description: 'Three easy sessions a week to keep the ball at your feet over the holidays. Garage, driveway or basement.',
    plan: { 1: ['bm1', 'juggle', 'ft1'], 2: ['bm2', 'juggle', 'ft1'], 3: ['bm3', 'juggle', 'light'] },
  },
};

/** Groups. `weekNow`: the program week this week is. */
const GROUPS = [
  { key: 'u10', name: 'U10 Ball Masters', weekday: 0, time: '16:30', program: 'foundations', weekNow: 4 },
  { key: 'u12', name: 'U12 Technical', weekday: 2, time: '17:30', program: 'touch', weekNow: 5 },
  { key: 'u14', name: 'U14 Attackers', weekday: 3, time: '18:00', program: 'attacker', weekNow: 5 },
  { key: 'sat', name: 'Saturday Speed', weekday: 5, time: '09:00', program: 'athlete', weekNow: 2 },
] as const;
type GroupKey = typeof GROUPS[number]['key'];

type Persona = {
  first: string; last: string; age: string; positions: string[]; foot: string;
  groups: GroupKey[];
  /** Days ago they joined. */
  joined: number;
  /** Team practice days and game days, 0 = Monday. Left out: they haven't said. */
  club?: number[]; games?: number[]; trainerDays?: number[];
  /** Share of past weeks' sessions done. */
  rate: number;
  /** This week: sessions already due that they've skipped, counting back from the latest. */
  missThisWeek?: number;
  /** Nothing in the last N days. */
  quiet?: number;
  never?: boolean;
  /** How their sessions tend to feel. */
  feels?: Feel[];
  /** A week built for them each Monday, not a program. */
  built?: { sessions: number; minutes: number; focus: string[] };
  /** A program of their own, beside any group's: started this many weeks ago. */
  own?: { program: keyof typeof PROGRAMS; weeksAgo: number };
  /** What they need to work on, shown on their page. */
  focus?: string[];
};

const PLAYERS: Persona[] = [
  // U10 Ball Masters, Mondays
  { first: 'Mia', last: 'Alvarez', age: 'u10', positions: ['Winger'], foot: 'right', groups: ['u10'], joined: 64, club: [1, 3], games: [5], rate: 1, feels: ['right', 'easy', 'right'] },
  { first: 'Jack', last: 'Brennan', age: 'u10', positions: ['Center mid'], foot: 'right', groups: ['u10'], joined: 64, club: [1, 3], games: [5], rate: 0.85 },
  { first: 'Zoe', last: 'Whitaker', age: 'u10', positions: ['Striker'], foot: 'left', groups: ['u10'], joined: 50, club: [2, 3], games: [6], rate: 0.7, missThisWeek: 1, focus: ['weak_foot'] },
  { first: 'Eli', last: 'Nakamura', age: 'u10', positions: ['Full back'], foot: 'right', groups: ['u10'], joined: 12, club: [1, 3], games: [5], rate: 1 },
  { first: 'Ruby', last: 'Castillo', age: 'u10', positions: ['Goalkeeper'], foot: 'right', groups: ['u10'], joined: 57, club: [1, 3], games: [5], rate: 0.9, quiet: 11 },

  // U12 Technical, Wednesdays
  { first: 'Lucas', last: 'Bennett', age: '10_12', positions: ['Center mid'], foot: 'both', groups: ['u12', 'sat'], joined: 80, club: [1, 3], games: [6], rate: 1, feels: ['right', 'easy', 'easy'] },
  { first: 'Leo', last: 'Marsh', age: '10_12', positions: ['Winger'], foot: 'left', groups: ['u12'], joined: 72, club: [0, 3], games: [5], rate: 0.9 },
  { first: 'Aria', last: 'Patel', age: '10_12', positions: ['Winger', 'Striker'], foot: 'right', groups: ['u12', 'sat'], joined: 72, club: [0, 3], games: [6], rate: 0.9 },
  { first: 'Owen', last: 'Fischer', age: '10_12', positions: ['Center back'], foot: 'right', groups: ['u12'], joined: 66, club: [1, 3], games: [5], rate: 0.5, missThisWeek: 2, feels: ['hard', 'right', 'hard'], focus: ['first_touch'] },
  { first: 'Nora', last: 'Lindqvist', age: '10_12', positions: ['Attacking mid'], foot: 'left', groups: ['u12'], joined: 45, club: [1, 4], games: [6], rate: 0.8, own: { program: 'athlete', weeksAgo: 1 } },
  { first: 'Caleb', last: 'Morris', age: '10_12', positions: ['Striker'], foot: 'right', groups: ['u12'], joined: 4, rate: 0, never: true },

  // U14 Attackers, Thursdays
  { first: 'Isla', last: 'Romero', age: '13_15', positions: ['Striker'], foot: 'right', groups: ['u14', 'sat'], joined: 90, club: [0, 2], games: [6], rate: 1, feels: ['right', 'right', 'easy'] },
  { first: 'Diego', last: 'Santos', age: '13_15', positions: ['Winger'], foot: 'left', groups: ['u14'], joined: 85, club: [0, 2], games: [5], rate: 0.75, missThisWeek: 1 },
  { first: 'Hannah', last: 'Kowalski', age: '13_15', positions: ['Defensive mid'], foot: 'right', groups: ['u14'], joined: 60, club: [1, 4], games: [6], rate: 0.85 },
  { first: 'Tyler', last: 'Grant', age: '13_15', positions: ['Full back', 'Winger'], foot: 'right', groups: ['u14'], joined: 85, club: [0, 2], games: [5], rate: 0.8, quiet: 16 },

  // One to one: a week built for each of them every Monday
  { first: 'Maya', last: 'Okonkwo', age: '16_18', positions: ['Attacking mid'], foot: 'right', groups: [], joined: 70, club: [0, 2, 3], games: [5], trainerDays: [1], rate: 1,
    feels: ['right', 'easy', 'right', 'right'], built: { sessions: 3, minutes: 45, focus: ['finishing', 'weak_foot'] } },
  { first: 'Ben', last: 'Hartley', age: '13_15', positions: ['Center back'], foot: 'right', groups: [], joined: 40, club: [1, 3], games: [6], trainerDays: [4], rate: 0.8,
    feels: ['right', 'hard', 'right'], built: { sessions: 2, minutes: 30, focus: ['first_touch', 'passing'] } },
];

const NOTES: { daysAgo: number; body: string; to: 'all' | GroupKey | string[]; seenBy: number; kind?: 'note' | 'nudge' }[] = [
  { daysAgo: 8, body: 'Good week, everyone. Ten minutes with a ball and a wall beats nothing, every time. If the week gets busy, do the first three drills and call it done.', to: 'all', seenBy: 0.75 },
  { daysAgo: 5, body: 'U14s: Thursday we finish with 1v1s to goal. Do Beat Your Defender before then so the moves are in your feet when you get there.', to: 'u14', seenBy: 0.75 },
  { daysAgo: 3, body: 'Tyler, it has been a couple of weeks. One short session this week gets you going again. Start with 1v1 Moves.', to: ['Tyler'], seenBy: 0, kind: 'nudge' },
  { daysAgo: 2, body: 'Mia, four weeks without missing a session. Your left foot at Monday training showed it. Keep going!', to: ['Mia'], seenBy: 1 },
];

/** "Just for you" drills this week. */
const ADDONS = [
  { to: 'Owen', drill: 'checkturn', note: 'Owen, look over your shoulder before the ball arrives, every time. Ten each way and you are done.' },
  { to: 'Zoe', drill: 'weakjuggle', note: 'Zoe, right foot only. Tell me your best on Monday.' },
];

/** Someone asking to join, waiting on the trainer's dashboard. */
const ASKING = { email: 'kestrel-asking@train.futbol', name: 'Priya Shah', as_who: 'parent', message: 'My daughter Anika is 11 and plays for Northgate. Is there room in the Wednesday group?' };

// --------------------------------------------------------------- dates ---
const now = Date.now();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
const dayMs = 86400000;
const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const addDays = (d: string, n: number) => new Date(toUtc(d) + n * dayMs).toISOString().slice(0, 10);
const weekdayOf = (d: string) => (new Date(toUtc(d)).getUTCDay() + 6) % 7;
const monday = addDays(today, -weekdayOf(today));
const daysAgo = (d: string) => Math.round((toUtc(today) - toUtc(d)) / dayMs);
/** When they trained that day, New York time: after school on weekdays, late morning at weekends. */
const trainedAt = (d: string, salt: number) => {
  const start = weekdayOf(d) >= 5 ? 15 * 60 : 21 * 60 + 30;
  return toUtc(d) + (start + (salt % 150)) * 60000;
};
const iso = (ms: number) => new Date(ms).toISOString();
/** Midday in New York on that date: safely that day in any zone the app reads it in. */
const noon = (d: string) => iso(toUtc(d) + 17 * 3600000);

/** Deterministic "random", so a re-run on the same day gives the same history. */
function chance(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}
const chunks = <T,>(a: T[], n = 80) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const sampleEmail = (p: Pick<Persona, 'first' | 'last'>) => `kestrel-${p.first.toLowerCase()}-${p.last.toLowerCase()}@train.futbol`;
const isSample = (email?: string | null) => !!email && /^kestrel-[a-z-]+@train\.futbol$/.test(email);

async function main() {
  // ------------------------------------------------------------ academy ---
  const logo = readFileSync(new URL('./demo-assets/kestrel-logo.png', import.meta.url)).toString('base64');
  let academy = await must(db.from('academies').select('id, setup').eq('slug', ACADEMY.slug).maybeSingle(), 'academy');
  if (academy && !(academy.setup as Record<string, unknown> | null)?.demo_seed) {
    throw new Error(`There is already an academy at "${ACADEMY.slug}" that this script didn't make. Leaving it alone.`);
  }
  const stamp = new Date(now).toISOString();
  const row = {
    ...ACADEMY, logo_type: 'image/png', logo_data: logo, billing_mode: 'none', library_access: false, listed: false,
    kind: 'trainer', updated_at: stamp,
  };
  if (!academy) {
    academy = await must(db.from('academies').insert({ ...row, setup: { you: stamp, done: stamp, demo_seed: true } }).select('id, setup').single(), 'create academy');
  } else {
    await must(db.from('academies').update(row).eq('id', academy.id), 'update academy');
  }
  const academyId = academy!.id as string;
  const { data: invites } = await db.from('academy_invites').select('role').eq('academy_id', academyId);
  const code = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const missing = (['player', 'trainer'] as const).filter((r) => !invites?.some((i) => i.role === r));
  if (missing.length) await must(db.from('academy_invites').insert(missing.map((role) => ({ code: code(), academy_id: academyId, role }))), 'invites');
  await must(db.from('academy_plan_defaults').upsert({
    academy_id: academyId, sessions: 3, minutes: 30, progress: true, player_library: true, player_extras: 2, player_speed: true,
  }), 'defaults');

  // -------------------------------------------------------------- people ---
  const byEmail = new Map<string, string>();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`list users: ${error.message}`);
    for (const u of data.users) if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }
  const account = async (email: string) => {
    const had = byEmail.get(email);
    if (had) return { id: had, fresh: false };
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) throw new Error(`create ${email}: ${error?.message}`);
    byEmail.set(email, data.user.id);
    return { id: data.user.id, fresh: true };
  };

  const members = await must(db.from('academy_members').select('user_id, role').eq('academy_id', academyId), 'members');
  let ownerId = members?.find((m) => m.role === 'owner')?.user_id as string | undefined;
  if (!ownerId) {
    if (!OWNER_EMAIL) throw new Error('First run: say who the trainer signs in as, with --owner you+kestrel@example.com');
    const owner = await account(OWNER_EMAIL);
    ownerId = owner.id;
    await must(db.from('academy_members').upsert({ academy_id: academyId, user_id: ownerId, role: 'owner', joined_at: noon(addDays(today, -95)) }), 'owner');
  }
  // A new account is named after the front of its email: not a name to show players.
  const { data: ownerUser } = await db.auth.admin.getUserById(ownerId);
  const { data: ownerProfile } = await db.from('profiles').select('display_name').eq('id', ownerId).maybeSingle();
  let coachName = ownerProfile?.display_name?.trim() ?? '';
  if (!coachName || coachName === ownerUser.user?.email?.split('@')[0]) {
    coachName = TRAINER_NAME;
    await must(db.from('profiles').upsert({ id: ownerId, display_name: coachName }), 'owner profile');
  }

  // The player you can sign in as: the address given, or whoever was Leo last time.
  const memberIds = (members ?? []).filter((m) => m.role === 'player').map((m) => m.user_id as string);
  const { data: memberProfiles } = memberIds.length
    ? await db.from('profiles').select('id, display_name').in('id', memberIds) : { data: [] as { id: string; display_name: string | null }[] };
  const wasLogin = memberProfiles?.find((p) => p.display_name === LOGIN_PLAYER)?.id as string | undefined;

  const ids: Record<string, string> = {};
  const sample = new Set<string>();
  for (const p of PLAYERS) {
    const name = `${p.first} ${p.last}`;
    let id: string;
    if (name === LOGIN_PLAYER && PLAYER_EMAIL) {
      const a = await account(PLAYER_EMAIL);
      if (!a.fresh && a.id !== wasLogin) {
        const { data: prof } = await db.from('profiles').select('display_name').eq('id', a.id).maybeSingle();
        if (prof?.display_name?.trim() && prof.display_name !== LOGIN_PLAYER) {
          throw new Error(`${PLAYER_EMAIL} is already ${prof.display_name}'s account. Use a fresh address for --player.`);
        }
      }
      id = a.id;
      if (wasLogin && wasLogin !== id) await db.from('academy_members').delete().eq('academy_id', academyId).eq('user_id', wasLogin);
    } else if (name === LOGIN_PLAYER && wasLogin) {
      id = wasLogin;
    } else {
      id = (await account(sampleEmail(p))).id;
      sample.add(id);
    }
    ids[p.first] = id;
    await must(db.from('profiles').upsert({ id, display_name: name, age_band: p.age, positions: p.positions, dominant_foot: p.foot }), 'profile');
    await must(db.from('academy_members').upsert({ academy_id: academyId, user_id: id, role: 'player', joined_at: noon(addDays(today, -p.joined)) }), 'member');
  }
  const players = Object.values(ids);

  // --------------------------------------------------------------- reset ---
  // Finished sessions first, while what they were sessions of is still here.
  const refs: string[] = [];
  for (const t of ['academy_sessions', 'player_week_sessions', 'addons']) {
    const rows = await must(db.from(t).select('id').eq('academy_id', academyId).limit(5000), `read ${t}`);
    refs.push(...(rows ?? []).map((r) => r.id as string));
  }
  for (const part of chunks(refs)) await must(db.from('workouts').delete().in('source', ['academy', 'addon']).in('source_ref', part), 'clear finished sessions');
  if (sample.size) {
    await must(db.from('workouts').delete().in('user_id', [...sample]), 'clear sample workouts');
    await must(db.from('plans').delete().in('user_id', [...sample]), 'clear sample plans');
  }
  await must(db.from('session_moves').delete().eq('academy_id', academyId), 'clear moves');
  for (const t of ['addons', 'player_week_sessions', 'player_plans', 'player_programs', 'groups', 'academy_sessions', 'academy_programs', 'library_sessions', 'drills', 'notes', 'join_requests']) {
    await must(db.from(t).delete().eq('academy_id', academyId), `clear ${t}`);
  }

  // ------------------------------------------------------------- content ---
  const madeDrills = await must(db.from('drills').insert(DRILLS.map((d) => ({
    academy_id: academyId, name: d.name, amount: d.amount, minutes: d.minutes, focus: d.tags[0], focus_areas: d.tags, how: d.how, created_by: ownerId,
  }))).select('id, name'), 'drills');
  const drillId = (k: string) => {
    const d = DRILLS.find((x) => x.key === k);
    if (!d) throw new Error(`No drill "${k}"`);
    return madeDrills!.find((x) => x.name === d.name)!.id as string;
  };
  for (const d of DRILLS.filter((x) => x.harder)) {
    await must(db.from('drills').update({ harder_id: drillId(d.harder!) }).eq('id', drillId(d.key)), 'harder version');
  }
  const drills: DrillRow[] = DRILLS.map((d) => ({
    id: drillId(d.key), name: d.name, amount: d.amount, minutes: d.minutes, focus: d.tags[0], focus_areas: d.tags, video_url: null, how: d.how,
    harder_id: d.harder ? drillId(d.harder) : null,
  }));

  const library = await must(db.from('library_sessions').insert(Object.values(SESSIONS).map((s) => ({
    academy_id: academyId, name: s.name, drill_ids: s.drills.map(drillId),
  }))).select('id, name'), 'session library');
  const libraryId = (k: string) => library!.find((x) => x.name === SESSIONS[k].name)!.id as string;

  const programId: Record<string, string> = {};
  const programs: ProgramRow[] = [];
  const sessions: SessionRow[] = [];
  for (const [k, p] of Object.entries(PROGRAMS)) {
    const made = await must(db.from('academy_programs').insert({ academy_id: academyId, name: p.name, weeks: p.weeks, description: p.description }).select('id').single(), 'program');
    programId[k] = made!.id;
    programs.push({ id: made!.id, name: p.name, weeks: p.weeks });
    const rows = Object.entries(p.plan).flatMap(([week, keys]) => keys.map((s, position) => ({
      academy_id: academyId, program_id: made!.id, week: Number(week), position, name: SESSIONS[s].name,
      drill_ids: SESSIONS[s].drills.map(drillId), library_id: libraryId(s),
    })));
    const got = await must(db.from('academy_sessions').insert(rows).select('id, program_id, week, position, name, drill_ids'), 'program sessions');
    sessions.push(...(got as SessionRow[]));
  }

  // -------------------------------------------------------------- groups ---
  const groups: GroupRow[] = [];
  const memberships: { group_id: string; user_id: string; added_at: string }[] = [];
  for (const g of GROUPS) {
    const startsOn = addDays(monday, -7 * (g.weekNow - 1));
    const made = await must(db.from('groups').insert({
      academy_id: academyId, name: g.name, meets_weekday: g.weekday, meets_time: g.time, program_id: programId[g.program], starts_on: startsOn,
    }).select('id').single(), 'group');
    groups.push({ id: made!.id, name: g.name, meets_weekday: g.weekday, meets_time: g.time, program_id: programId[g.program], starts_on: startsOn });
    for (const p of PLAYERS.filter((x) => x.groups.includes(g.key))) {
      // In it from its first week, or from the day they joined if that was later.
      const joined = addDays(today, -p.joined);
      memberships.push({ group_id: made!.id, user_id: ids[p.first], added_at: noon(joined > startsOn ? joined : startsOn) });
    }
  }
  await must(db.from('group_members').insert(memberships.map((m) => ({ ...m, academy_id: academyId }))), 'group members');
  // By name, as the app reads them: the order decides which session lands on which day.
  groups.sort((a, b) => a.name.localeCompare(b.name));

  const playerPrograms: PlayerProgramRow[] = PLAYERS.filter((p) => p.own).map((p) => ({
    user_id: ids[p.first], program_id: programId[p.own!.program], starts_on: addDays(monday, -7 * p.own!.weeksAgo),
  }));
  if (playerPrograms.length) await must(db.from('player_programs').insert(playerPrograms.map((x) => ({ ...x, academy_id: academyId }))), 'own programs');

  // Soccer days: their own row. A signed-in player's are left as they set them.
  const schedules: ScheduleRow[] = PLAYERS.filter((p) => p.club || p.games).map((p) => ({
    user_id: ids[p.first], club_days: p.club ?? [], game_day: p.games?.[0] ?? null, game_days: p.games ?? [], trainer_days: p.trainerDays ?? [],
  }));
  const { data: said } = await db.from('player_schedules').select('user_id').in('user_id', players);
  const hasOwn = new Set((said ?? []).map((r) => r.user_id as string));
  await must(db.from('player_schedules').upsert(schedules.filter((s) => sample.has(s.user_id) || !hasOwn.has(s.user_id)).map((s) => ({ ...s, updated_at: stamp }))), 'soccer days');
  await must(db.from('player_schedules').delete().in('user_id', PLAYERS.filter((p) => !p.club && !p.games).map((p) => ids[p.first]).filter((id) => sample.has(id))), 'no soccer days');

  const plans = PLAYERS.filter((p) => p.built || p.focus).map((p) => ({
    academy_id: academyId, user_id: ids[p.first], sessions: p.built?.sessions ?? null, minutes: p.built?.minutes ?? null,
    focus: p.built?.focus ?? p.focus ?? [], mode: p.built ? 'custom' : null, progress: null as boolean | null, autopilot: false,
  }));
  await must(db.from('player_plans').insert(plans), 'player plans');

  // ------------------------------------------------------------- history ---
  type Run = { user_id: string; title: string; source: string; source_ref: string; exercise_ids: string[]; done_ids: string[];
    planned_minutes: number; actual_minutes: number; planned_touches: number; actual_touches: number; status: string;
    completed_at: string; created_at: string; feel: Feel };
  const WEEKS_BACK = 5;
  let total = 0;
  const lines: string[] = [];

  for (const [i, p] of PLAYERS.entries()) {
    const uid = ids[p.first];
    const joined = addDays(today, -p.joined);
    const runs: Run[] = [];
    const feels = p.feels ?? ['right', 'right', 'easy', 'right', 'hard'];
    const minutesOf = (list: string[]) => list.reduce((a, id) => a + (drills.find((d) => d.id === id)?.minutes ?? 0), 0);

    /** Whether a session set for `date` has had its day. Today's has, for the
     *  players who don't miss: run in the morning, the dashboard still shows
     *  today's ticks, done a little while ago. */
    const due = (date: string) => date < today || (date === today && (p.rate >= 0.85 || trainedAt(date, i * 37) < now - 20 * 60000));
    const finish = (date: string, ref: string, title: string, list: string[], n: number) => {
      const at = iso(Math.min(trainedAt(date, i * 37 + n * 11), now - (25 + ((i * 37 + n * 11) % 100)) * 60000));
      const planned = minutesOf(list);
      const all = list.map((id, k) => `${id}:${k}`);
      // Now and then the last drill gets left.
      const kept = chance(`${p.first}${at}skip`) < 0.12 && all.length > 3 ? all.slice(0, -1) : all;
      runs.push({
        user_id: uid, title, source: 'academy', source_ref: ref, exercise_ids: all, done_ids: kept,
        planned_minutes: planned, actual_minutes: Math.max(10, planned + Math.round(chance(`${p.first}${at}len`) * 8) - 3),
        planned_touches: 0, actual_touches: 0, status: 'completed', completed_at: at, created_at: at,
        feel: feels[Math.floor(chance(`${p.first}${at}feel`) * feels.length)],
      });
    };
    /** Goes through one week's set sessions, finishing the ones this player would have. */
    const play = (weekOf: string, items: { ref: string; title: string; weekday: number; drill_ids: string[] }[]) => {
      const dueNow = items.filter((it) => { const d = addDays(weekOf, it.weekday); return d >= joined && due(d); });
      const skipped = new Set(weekOf === monday && p.missThisWeek ? dueNow.slice(-p.missThisWeek).map((it) => it.ref) : []);
      const done = new Set<string>();
      dueNow.forEach((it, n) => {
        const date = addDays(weekOf, it.weekday);
        if (p.never || (p.quiet && daysAgo(date) < p.quiet) || skipped.has(it.ref)) return;
        // Past weeks go by their rate, though the last session of last week
        // is always done: "behind" should read as behind, not as gone quiet.
        const lastOfLastWeek = weekOf === addDays(monday, -7) && n === dueNow.length - 1;
        if (weekOf !== monday && !lastOfLastWeek && chance(`${p.first}${weekOf}${n}`) >= p.rate) return;
        finish(date, it.ref, it.title, it.drill_ids, n + weekdayOf(date));
        done.add(it.ref);
      });
      return done;
    };

    if (p.built) {
      // A week built each Monday from the one before, as the trainer area does it.
      const past: PastWeek[] = [];
      const busy = teamDays(schedules.find((s) => s.user_id === uid));
      for (let back = Math.min(WEEKS_BACK - 1, Math.floor(p.joined / 7)); back >= 0; back--) {
        const weekOf = addDays(monday, -7 * back);
        const built = buildPlayerWeek({
          drills, target: p.built, focus: p.built.focus, busy, seed: `${uid}:${weekOf}`, weekOf, history: past,
          recent: past.slice(0, 2).flatMap((w) => w.sessions.flatMap((x) => x.drill_ids)),
        });
        const made = await must(db.from('player_week_sessions').insert(built.map((s, position) => ({
          academy_id: academyId, user_id: uid, week_of: weekOf, position, name: s.name, drill_ids: s.drill_ids, weekday: s.weekday,
          made_by: 'rules', steps: s.steps, light: s.light, changes: s.changes, created_at: iso(toUtc(weekOf) + 8 * 3600000),
          note: back === 0 && position === 0 ? `${p.first}, new drills are in from last week. Quality over speed on the first set.` : null,
        }))).select('id, position, name, drill_ids, weekday'), 'built week');
        const rows = [...(made ?? [])].sort((a, b) => a.position - b.position);
        const done = play(weekOf, rows.map((r) => ({ ref: r.id, title: r.name, weekday: r.weekday, drill_ids: r.drill_ids })));
        past.unshift({ week_of: weekOf, light: built.some((s) => s.light), sessions: rows.map((r, k) => {
          const run = runs.find((x) => x.source_ref === r.id);
          return { drill_ids: r.drill_ids, steps: built[k].steps, done: done.has(r.id), feel: run?.feel ?? null, ticked: run?.done_ids ?? null,
            open: !done.has(r.id) && addDays(weekOf, r.weekday) >= today };
        }) });
      }
    } else {
      for (let back = WEEKS_BACK; back >= 0; back--) {
        const weekOf = addDays(monday, -7 * back);
        const week = setItems(buildWeek({
          userId: uid, today: back ? weekOf : today, tz: TZ, groups, memberships, playerPrograms, programs, sessions, drills,
          addons: [], completions: [], schedules, custom: [] as CustomRow[], plans: [],
        }));
        play(weekOf, week.map((it) => ({ ref: it.ref, title: it.title, weekday: it.weekday, drill_ids: sessions.find((s) => s.id === it.ref)?.drill_ids ?? [] })));
      }
    }
    for (const part of chunks(runs, 200)) await must(db.from('workouts').insert(part), 'finished sessions');
    total += runs.length;
    const last = runs.at(-1)?.completed_at.slice(0, 10);
    lines.push(`  ${`${p.first} ${p.last}`.padEnd(16)} ${String(runs.length).padStart(2)} done${last ? `, last ${last}` : ''}`);
  }

  // --------------------------------------------------- extras and notes ---
  await must(db.from('addons').insert(ADDONS.map((a) => ({
    academy_id: academyId, user_id: ids[a.to], drill_id: drillId(a.drill), week_of: monday, created_by: ownerId, note: a.note,
    created_at: iso(toUtc(monday) + 14 * 3600000),
  }))), 'just for you');

  for (const n of NOTES) {
    const to = n.to === 'all' ? PLAYERS : Array.isArray(n.to) ? PLAYERS.filter((p) => (n.to as string[]).includes(p.first))
      : PLAYERS.filter((p) => p.groups.includes(n.to as GroupKey));
    const at = now - n.daysAgo * dayMs;
    const note = await must(db.from('notes').insert({
      academy_id: academyId, author_id: ownerId, author_name: coachName, kind: n.kind ?? 'note', body: n.body, created_at: iso(at),
    }).select('id').single(), 'note');
    await must(db.from('note_recipients').insert(to.filter((p) => addDays(today, -p.joined) <= addDays(today, -n.daysAgo)).map((p) => ({
      note_id: note!.id, user_id: ids[p.first],
      seen_at: !p.never && !p.quiet && chance(`${p.first}${n.body}`) < n.seenBy ? iso(at + 3 * 3600000) : null,
    }))), 'note recipients');
  }

  // Someone waiting to be let in. Not worth failing the run over.
  try {
    const asking = await account(ASKING.email);
    await must(db.from('profiles').upsert({ id: asking.id, display_name: ASKING.name }), 'asking profile');
    await must(db.from('join_requests').insert({
      academy_id: academyId, user_id: asking.id, name: ASKING.name, message: ASKING.message, role: 'player', as_who: ASKING.as_who,
      created_at: iso(now - 5 * 3600000),
    }), 'join request');
  } catch (e) {
    console.log(`  (join request skipped: ${(e as Error).message})`);
  }

  console.log(lines.join('\n'));
  console.log(`\n${ACADEMY.name}: ${DRILLS.length} drills, ${Object.keys(SESSIONS).length} sessions, ${Object.keys(PROGRAMS).length} programs, ${GROUPS.length} groups, ${players.length} players, ${total} finished sessions.`);
  console.log(`https://${ACADEMY.slug}.train.futbol  (week of ${monday}, as of ${today})`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
