import { demoUrl, guideFor, plainRest } from './speed-guide';
import type { Exercise, FocusArea } from './types';

/**
 * The speed module: a 12-month speed and stamina program for 13–16 year olds,
 * built as four 12-week phases, each of three 4-week blocks, each block ending
 * in a test day. Portable like session-builder.ts — nothing here touches React,
 * Next or the network.
 *
 * Why it is its own module rather than four more programs in the library:
 * the library is flat (program → session → drill) and the runner ticks drills
 * off. Speed training has structure the library has no slot for — a block has
 * weeks that load differently, a test day sets the next block's numbers, and
 * a growth spurt changes the whole prescription. So the program lives here,
 * and only the *session* crosses into the library's shape (see asExercise),
 * which is what lets the Runner play it and history keep it.
 */

export type PhaseId = 'foundation' | 'build' | 'power' | 'inseason';
export type SpeedSessionKind = 'speedA' | 'speedB' | 'stamina' | 'games' | 'strength';

export interface SpeedDrill {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  /** Planned clock time for the whole drill, rest included. */
  seconds: number;
  focus: FocusArea;
  /** The one thing to say before the rep. A teenager holds one thought at speed. */
  cue: string;
  equipment?: string[];
  /** Estimated ball touches, for the few drills that use one. */
  touches?: number;
  intensity?: 'low' | 'moderate' | 'high';
}

export interface SpeedSession {
  id: string;
  phase: PhaseId;
  block: 1 | 2 | 3;
  kind: SpeedSessionKind;
  name: string;
  /** Mon / Tue / Thu / Fri / Sat — the day in the weekly template. */
  day: string;
  where: 'outdoor' | 'indoor' | 'any';
  drills: SpeedDrill[];
  /** Metres of maximal sprinting, so volume caps are visible. */
  sprintMetres: number;
}

export interface Phase {
  id: PhaseId;
  number: 1 | 2 | 3 | 4;
  name: string;
  months: string;
  goal: string;
  /** What the week-12 test must show to leave the phase. */
  gate: string;
  sprintCap: number;   // max metres of maximal sprinting per session
  contactCap: number;  // max plyometric ground contacts per session
}

/* ---- phases --------------------------------------------------------------- */

export const PHASES: Phase[] = [
  {
    id: 'foundation', number: 1, name: 'Foundation', months: 'Nov – Jan',
    goal: 'Clean acceleration mechanics over 20 m and the aerobic base to train hard three times a week. The highest-return phase of the year: expect 0.1–0.2 s off a 20 m time from technique alone.',
    gate: 'Film a 20 m sprint from the side. Pass = forward lean out of the start without bending at the waist, full back-leg extension on the first 3 steps, arms driving from the shoulder, no heel-first contacts after step 3.',
    sprintCap: 200, contactCap: 60,
  },
  {
    id: 'build', number: 2, name: 'Build', months: 'Feb – Apr',
    goal: 'Raise top speed, teach the body to cut and re-accelerate, and build repeat sprint ability — the quality that decides who is still fast in the 80th minute.',
    gate: 'Flying 20 m faster than the Phase 1 test, and RSA total time improved.',
    sprintCap: 300, contactCap: 100,
  },
  {
    id: 'power', number: 3, name: 'Power', months: 'May – Jul',
    goal: 'Turn good mechanics into force. Hills, light resistance and bigger plyometrics make every step push harder; ball work ties the new speed to the game before the season starts.',
    gate: 'Three consecutive single-leg hop landings on each leg, filmed, with the knee over the second toe and no collapse inward.',
    sprintCap: 300, contactCap: 100,
  },
  {
    id: 'inseason', number: 4, name: 'In-season', months: 'Aug – Oct',
    goal: 'Keep every gain from the off-season with the least possible fatigue. Speed is kept by touching it twice a week at full intensity and tiny volume; it is lost in about three weeks if ignored.',
    gate: 'Two weeks off sprinting and plyometrics at the end of October, then the cycle restarts at Phase 1 with this year’s numbers as the new baseline.',
    sprintCap: 150, contactCap: 50,
  },
];

export const phaseById = (id: string) => PHASES.find((p) => p.id === id);

/* ---- the 4-week block ----------------------------------------------------- */

export const BLOCK_WEEKS = [
  { week: 1, name: 'Learn', load: 'New drills at 80% of the block’s volume', feel: '“This is new”' },
  { week: 2, name: 'Load', load: 'Full volume, full intensity', feel: '“This is hard”' },
  { week: 3, name: 'Peak', load: 'Full volume, add one rep or 5 m to the main sprints', feel: '“I’m getting it”' },
  { week: 4, name: 'Test', load: 'Volume halved Mon–Wed, test day Thu, easy Fri–Sat', feel: '“Show me the number”' },
] as const;

export const WEEK_TEMPLATE = [
  { day: 'Mon', kind: 'speedA' as const, label: 'Acceleration · first steps', minutes: 60 },
  { day: 'Tue', kind: 'stamina' as const, label: 'Stamina · runs', minutes: 45 },
  { day: 'Wed', kind: null, label: 'Off, or light ball skills', minutes: 0 },
  { day: 'Thu', kind: 'speedB' as const, label: 'Top speed · or agility', minutes: 60 },
  { day: 'Fri', kind: 'strength' as const, label: 'Strength + jumps', minutes: 40 },
  { day: 'Sat', kind: 'games' as const, label: 'Match, or small-sided games', minutes: 60 },
  { day: 'Sun', kind: null, label: 'Off', minutes: 0 },
];

export const KIND_LABELS: Record<SpeedSessionKind, string> = {
  speedA: 'Acceleration', speedB: 'Top speed', stamina: 'Stamina', games: 'Games', strength: 'Strength + jumps',
};

/* ---- warm-up: every session ------------------------------------------------ */

const cones = ['cones'];
const hurdles = ['mini hurdles'];
const sticks = ['sticks'];
const ball = ['ball'];
const none: string[] = [];

const d = (
  name: string, sets: string, reps: string, rest: string, seconds: number,
  focus: FocusArea, cue: string, extra: Partial<SpeedDrill> = {},
): SpeedDrill => ({ name, sets, reps, rest, seconds, focus, cue, equipment: none, intensity: 'moderate', ...extra });

/** RAMP warm-up, 12–15 minutes, in the same order every time. */
export const WARMUP: SpeedDrill[] = [
  d('Raise: jog, shuffle, backpedal, carioca', '1', '20 m each', '-', 180, 'mobility', 'Light feet, tall chest', { intensity: 'low' }),
  d('Activate: glute bridge, ring walks, single-leg balance, calf raise', '1', '10 / 10 / 20 s / 15', '-', 180, 'strength', 'Squeeze the glutes before you move', { intensity: 'low', equipment: ['agility rings'] }),
  d('Mobilize: walking lunge with twist, leg swings, inchworm, hip opener', '1', '8 / 10 / 5 / 8', '-', 180, 'mobility', 'Big range, under control', { intensity: 'low' }),
  d('Potentiate: A-skip, B-skip, high knees, straight-leg bound', '2', '20 m each', '-', 240, 'speed', 'Punch the knee, snap the foot down under the hip'),
  d('Build-up runs to 90%', '3', '30 m', 'walk back', 180, 'speed', 'Jog in, full speed by the end', { intensity: 'high' }),
];

/* ---- drills, by block ----------------------------------------------------- */

type BlockSessions = Record<SpeedSessionKind, { name: string; drills: SpeedDrill[]; sprintMetres: number; where: SpeedSession['where'] }>;

const FOUNDATION: BlockSessions[] = [
  {
    speedA: { name: 'Falling starts', where: 'any', sprintMetres: 100, drills: [
      d('Wall drill', '3', '10 s each leg', '30 s', 180, 'speed', 'Drive the knee, stay long'),
      d('Falling start', '6', '10 m', '60 s', 420, 'speed', 'Fall, then push', { intensity: 'high', equipment: cones }),
      d('2-point start', '4', '15 m', '90 s', 400, 'speed', 'Push the ground away behind you', { intensity: 'high', equipment: cones }),
    ] },
    speedB: { name: 'Footwork and rhythm', where: 'indoor', sprintMetres: 0, drills: [
      d('Ankling and dribbles', '3', '20 m', '30 s', 240, 'speed', 'Stiff ankle, quick off the ground'),
      d('A-march and A-skip', '3', '20 m', '30 s', 240, 'speed', 'Knee up, toe up, snap down'),
      d('Low hurdle step-overs', '3', '6 hurdles', '45 s', 240, 'agility', 'Step over, land under the hip', { equipment: hurdles }),
      d('Stick run, 1.2 m spacing', '4', '6 sticks', '60 s', 300, 'speed', 'Punch the ground between sticks', { equipment: sticks, intensity: 'high' }),
    ] },
    stamina: { name: 'Tempo 60s', where: 'outdoor', sprintMetres: 0, drills: [
      d('Tempo run at 70%', '10', '60 m', 'walk back', 900, 'conditioning', 'Smooth — you could hold a conversation at the end', { equipment: cones }),
    ] },
    games: { name: '4v4, 30 × 20 m', where: 'outdoor', sprintMetres: 0, drills: [
      d('4v4 small-sided game', '4', '4 min', '2 min', 1440, 'conditioning', 'No walking, ever', { equipment: [...ball, ...cones], touches: 200, intensity: 'high' }),
    ] },
    strength: { name: 'Bodyweight and small jumps', where: 'indoor', sprintMetres: 0, drills: [
      d('Box squat, split squat, single-leg glute bridge', '3', '10 each', '60 s', 540, 'strength', 'Knee over the toe, chest tall'),
      d('Push-up and plank variations', '3', '10 / 30 s', '45 s', 360, 'core', 'Ribs down, straight line'),
      d('Pogo hops', '3', '20', '45 s', 180, 'power', 'Stiff ankles, quiet feet'),
      d('Low hurdle hops, 15 cm', '3', '6', '60 s', 240, 'power', 'Land where you took off', { equipment: hurdles }),
    ] },
  },
  {
    speedA: { name: 'Three-point starts', where: 'any', sprintMetres: 160, drills: [
      d('Falling start', '4', '15 m', '90 s', 420, 'speed', 'Fall, then push', { intensity: 'high', equipment: cones }),
      d('3-point start', '4', '20 m', '2 min', 540, 'speed', 'Push the ground away behind you', { intensity: 'high', equipment: cones }),
      d('Partner push-release start', '4', '20 m', '2 min', 540, 'speed', 'Lean into the towel', { intensity: 'high', equipment: ['towel'] }),
    ] },
    speedB: { name: 'Fast feet', where: 'indoor', sprintMetres: 40, drills: [
      d('A-skip and B-skip', '3', '20 m', '30 s', 240, 'speed', 'Knee up, toe up, snap down'),
      d('Agility ring quick feet: in-in-out', '4', '6 rings', '45 s', 240, 'agility', 'In and out, no stomping', { equipment: ['agility rings'] }),
      d('Stick run, 1.5 m spacing', '4', '6 sticks', '60 s', 300, 'speed', 'Eyes up, not on the sticks', { equipment: sticks, intensity: 'high' }),
      d('Sprint', '2', '20 m', '2 min', 300, 'speed', 'Tall, relaxed face, fast feet down', { intensity: 'high', equipment: cones }),
    ] },
    stamina: { name: 'Tempo 60s', where: 'outdoor', sprintMetres: 0, drills: [
      d('Tempo run at 70%', '13', '60 m', 'walk back', 1170, 'conditioning', 'Same time every rep', { equipment: cones }),
    ] },
    games: { name: '4v4, 30 × 20 m', where: 'outdoor', sprintMetres: 0, drills: [
      d('4v4 small-sided game', '5', '4 min', '2 min', 1800, 'conditioning', 'No walking, ever', { equipment: [...ball, ...cones], touches: 250, intensity: 'high' }),
    ] },
    strength: { name: 'Bodyweight and small jumps', where: 'indoor', sprintMetres: 0, drills: [
      d('Box squat, split squat, single-leg glute bridge', '3', '12 each', '60 s', 600, 'strength', 'Knee over the toe, chest tall'),
      d('Push-up and plank variations', '3', '12 / 40 s', '45 s', 400, 'core', 'Ribs down, straight line'),
      d('Pogo hops', '3', '20', '45 s', 180, 'power', 'Stiff ankles, quiet feet'),
      d('Low hurdle hops, 15 cm', '3', '6', '60 s', 240, 'power', 'Land where you took off', { equipment: hurdles }),
      d('Skip for height', '3', '15 m', '45 s', 200, 'power', 'Drive the knee up, land soft'),
    ] },
  },
  {
    speedA: { name: 'Starts to 30 m', where: 'outdoor', sprintMetres: 200, drills: [
      d('3-point start', '4', '20 m', '2 min', 540, 'speed', 'Push the ground away behind you', { intensity: 'high', equipment: cones }),
      d('Lying-start get-up', '4', '20 m', '2 min', 540, 'speed', 'Up and gone — no wasted step', { intensity: 'high', equipment: cones }),
      d('Standing start', '2', '30 m', '3 min', 400, 'speed', 'Stay low for 6 steps, then rise', { intensity: 'high', equipment: cones }),
    ] },
    speedB: { name: 'Stride and fly-in', where: 'outdoor', sprintMetres: 80, drills: [
      d('A-skip and B-skip', '3', '20 m', '30 s', 240, 'speed', 'Knee up, toe up, snap down'),
      d('Stick run, 1.6–1.8 m spacing', '4', '6 sticks', '60 s', 300, 'speed', 'Punch the ground between sticks', { equipment: sticks, intensity: 'high' }),
      d('Sprint with 5 m fly-in', '4', '20 m', '2 min', 540, 'speed', 'Tall, relaxed face, fast feet down', { intensity: 'high', equipment: cones }),
    ] },
    stamina: { name: 'Tempo 60s', where: 'outdoor', sprintMetres: 0, drills: [
      d('Tempo run at 70%', '16', '60 m', 'walk back', 1440, 'conditioning', 'Same time every rep', { equipment: cones }),
    ] },
    games: { name: '4v4, 30 × 20 m', where: 'outdoor', sprintMetres: 0, drills: [
      d('4v4 small-sided game', '5', '4 min', '2 min', 1800, 'conditioning', 'No walking, ever', { equipment: [...ball, ...cones], touches: 250, intensity: 'high' }),
    ] },
    strength: { name: 'Bodyweight and small jumps', where: 'indoor', sprintMetres: 0, drills: [
      d('Box squat, split squat, single-leg glute bridge', '3', '12 each', '60 s', 600, 'strength', 'Knee over the toe, chest tall'),
      d('Push-up and plank variations', '3', '12 / 45 s', '45 s', 420, 'core', 'Ribs down, straight line'),
      d('Pogo hops', '3', '20', '45 s', 180, 'power', 'Stiff ankles, quiet feet'),
      d('Low hurdle hops, 15 cm', '3', '6', '60 s', 240, 'power', 'Land where you took off', { equipment: hurdles }),
      d('Skip for height', '3', '15 m', '45 s', 200, 'power', 'Drive the knee up, land soft'),
    ] },
  },
];

const BUILD: BlockSessions[] = [
  {
    speedA: { name: 'Flying 10s and wickets', where: 'outdoor', sprintMetres: 220, drills: [
      d('3-point start', '3', '20 m', '2 min', 400, 'speed', 'Push the ground away behind you', { intensity: 'high', equipment: cones }),
      d('Flying 10 m, 20 m build-in', '4', '30 m', '2 min', 540, 'speed', 'Tall, relaxed face, fast feet down', { intensity: 'high', equipment: cones }),
      d('Wicket run, 1.5–1.7 m', '4', '8 hurdles', '2 min', 540, 'speed', 'Step over, land under', { intensity: 'high', equipment: hurdles }),
    ] },
    speedB: { name: 'Pre-planned cuts', where: 'any', sprintMetres: 60, drills: [
      d('5-10-5 shuttle', '6', '20 m', '90 s', 600, 'agility', 'Plant outside the hip, chest over the knee', { intensity: 'high', equipment: cones }),
      d('L-drill', '4', 'each side', '90 s', 480, 'agility', 'Low hips at the cone', { intensity: 'high', equipment: cones }),
      d('45-degree cut', '6', 'each side, 10 m', '60 s', 480, 'agility', 'Chest over the knee on the plant', { intensity: 'high', equipment: cones }),
    ] },
    stamina: { name: 'RSA runs', where: 'outdoor', sprintMetres: 0, drills: [
      d('Repeat sprints at 90%, 6 × 30 m, 20 s rest', '2', '6 × 30 m', '4 min', 780, 'conditioning', 'Every rep is a race', { intensity: 'high', equipment: cones }),
    ] },
    games: { name: '3v3, 25 × 15 m', where: 'outdoor', sprintMetres: 0, drills: [
      d('3v3 small-sided game', '6', '3 min', '90 s', 1620, 'conditioning', 'Small field, constant sprinting', { equipment: [...ball, ...cones], touches: 250, intensity: 'high' }),
    ] },
    strength: { name: 'Single-leg strength', where: 'indoor', sprintMetres: 0, drills: [
      d('Rear-foot-elevated split squat', '3', '8 each', '60 s', 420, 'strength', 'Back knee to the floor, front knee over the toe', { equipment: ['bench'] }),
      d('Single-leg Romanian deadlift', '3', '8 each', '60 s', 420, 'strength', 'Hinge, flat back, reach the heel back'),
      d('Nordic curl eccentric', '3', '5', '90 s', 420, 'strength', 'Fight it all the way down', { equipment: ['partner'] }),
      d('Hurdle hops, 20–30 cm', '4', '6', '60 s', 300, 'power', 'Land where you took off', { equipment: hurdles }),
      d('Standing long jump', '1', '8', '30 s', 240, 'power', 'Arms through, stick it'),
      d('Drop and stick, 30 cm box', '1', '8', '30 s', 240, 'power', 'Silent landing, hold 2 seconds', { equipment: ['box'] }),
    ] },
  },
  {
    speedA: { name: 'Flying 20s', where: 'outdoor', sprintMetres: 280, drills: [
      d('Flying 20 m, 25 m build-in', '4', '45 m', '2–3 min', 720, 'speed', 'Hit top speed, then let it ride', { intensity: 'high', equipment: cones }),
      d('Wicket run, 1.7–1.9 m', '4', '8 hurdles', '2 min', 540, 'speed', 'Step over, land under', { intensity: 'high', equipment: hurdles }),
      d('Standing start', '2', '40 m', '3 min', 420, 'speed', 'Stay low for 6 steps, then rise', { intensity: 'high', equipment: cones }),
    ] },
    speedB: { name: 'Reactive cuts', where: 'any', sprintMetres: 80, drills: [
      d('Mirror drill in pairs', '6', '10 s', '50 s', 360, 'agility', 'React with the feet, not the eyes', { intensity: 'high', equipment: ['partner'] }),
      d('Coach-pointed cut', '8', '10 m', '60 s', 600, 'agility', 'Plant outside, drive inside', { intensity: 'high', equipment: cones }),
      d('1v1 shadowing with the ball', '6', '15 s', '60 s', 450, 'agility', 'Attack the defender’s front foot', { intensity: 'high', equipment: ball, touches: 60 }),
    ] },
    stamina: { name: 'RSA runs', where: 'outdoor', sprintMetres: 0, drills: [
      d('Repeat sprints at 90%, 6 × 30 m, 20 s rest', '3', '6 × 30 m', '4 min', 1140, 'conditioning', 'Every rep is a race', { intensity: 'high', equipment: cones }),
    ] },
    games: { name: 'Tempo 100s', where: 'outdoor', sprintMetres: 0, drills: [
      d('Tempo run at 75%', '10', '100 m', '100 m walk', 1200, 'conditioning', 'Same time every rep', { equipment: cones }),
    ] },
    strength: { name: 'Single-leg strength', where: 'indoor', sprintMetres: 0, drills: [
      d('Rear-foot-elevated split squat', '3', '8 each', '60 s', 420, 'strength', 'Back knee to the floor, front knee over the toe', { equipment: ['bench'] }),
      d('Single-leg Romanian deadlift', '3', '8 each', '60 s', 420, 'strength', 'Hinge, flat back, reach the heel back'),
      d('Step-up to bench', '3', '8 each', '60 s', 420, 'strength', 'Drive through the heel, no push off the back foot', { equipment: ['bench'] }),
      d('Nordic curl eccentric', '3', '5', '90 s', 420, 'strength', 'Fight it all the way down', { equipment: ['partner'] }),
      d('Hurdle hops, 20–30 cm', '4', '6', '60 s', 300, 'power', 'Land where you took off', { equipment: hurdles }),
      d('Lateral bound', '3', '8 each side', '60 s', 360, 'power', 'Stick it, hold 2 seconds'),
    ] },
  },
  {
    speedA: { name: 'Max velocity', where: 'outdoor', sprintMetres: 300, drills: [
      d('Flying 20 m, 25 m build-in', '3', '45 m', '3 min', 600, 'speed', 'Hit top speed, then let it ride', { intensity: 'high', equipment: cones }),
      d('3-point start', '3', '40 m', '3 min', 600, 'speed', 'Push the ground away behind you', { intensity: 'high', equipment: cones }),
      d('Build-fly-relax', '1', '60 m', '-', 180, 'speed', 'Hit top speed, then let it ride', { intensity: 'high', equipment: cones }),
    ] },
    speedB: { name: 'Reactive with the ball', where: 'outdoor', sprintMetres: 120, drills: [
      d('1v1 to goal from a 10 m sprint', '6', 'each role', '90 s', 720, 'agility', 'Attack the defender’s front foot', { intensity: 'high', equipment: [...ball, ...cones, 'goal'], touches: 40 }),
      d('Pass and react: receive, turn on a call, sprint 15 m', '8', '15 m', '60 s', 600, 'agility', 'First touch out of your feet, then go', { intensity: 'high', equipment: [...ball, ...cones], touches: 40 }),
    ] },
    stamina: { name: 'RSA runs', where: 'outdoor', sprintMetres: 0, drills: [
      d('Repeat sprints at 90%, 8 × 30 m, 20 s rest', '2', '8 × 30 m', '4 min', 920, 'conditioning', 'Every rep is a race', { intensity: 'high', equipment: cones }),
    ] },
    games: { name: '3v3, 25 × 15 m', where: 'outdoor', sprintMetres: 0, drills: [
      d('3v3 small-sided game', '6', '3 min', '90 s', 1620, 'conditioning', 'Small field, constant sprinting', { equipment: [...ball, ...cones], touches: 250, intensity: 'high' }),
    ] },
    strength: { name: 'Single-leg strength', where: 'indoor', sprintMetres: 0, drills: [
      d('Rear-foot-elevated split squat', '3', '10 each', '60 s', 480, 'strength', 'Back knee to the floor, front knee over the toe', { equipment: ['bench'] }),
      d('Single-leg Romanian deadlift', '3', '10 each', '60 s', 480, 'strength', 'Hinge, flat back, reach the heel back'),
      d('Nordic curl eccentric', '3', '6', '90 s', 450, 'strength', 'Fight it all the way down', { equipment: ['partner'] }),
      d('Hurdle hops, 30 cm', '4', '6', '60 s', 300, 'power', 'Land where you took off', { equipment: hurdles }),
      d('Lateral bound', '3', '8 each side', '60 s', 360, 'power', 'Stick it, hold 2 seconds'),
      d('Drop and stick, 30 cm box', '1', '8', '30 s', 240, 'power', 'Silent landing, hold 2 seconds', { equipment: ['box'] }),
    ] },
  },
];

const POWER: BlockSessions[] = [
  {
    speedA: { name: 'Hill contrast', where: 'outdoor', sprintMetres: 180, drills: [
      d('Hill sprint, 5–8% grade', '6', '20 m', '2 min, walk down', 840, 'power', 'Big push, big arms', { intensity: 'high' }),
      d('Flat sprint straight after', '3', '20 m', '2 min', 400, 'speed', 'Same shape as the hill, faster feet', { intensity: 'high', equipment: cones }),
    ] },
    speedB: { name: 'Sprint, receive, finish', where: 'outdoor', sprintMetres: 180, drills: [
      d('20 m sprint onto a played ball, one touch, finish', '8', '20 m', '90 s', 840, 'speed', 'Sprint first, ball second', { intensity: 'high', equipment: [...ball, 'goal'], touches: 16 }),
      d('Dribble-sprint: 10 m dribble into 20 m sprint', '6', '30 m', '90 s', 660, 'speed', 'Last touch big, then leave it', { intensity: 'high', equipment: [...ball, ...cones], touches: 36 }),
    ] },
    stamina: { name: 'Interval 200s', where: 'outdoor', sprintMetres: 0, drills: [
      d('200 m at 80%', '8', '200 m', '90 s', 1200, 'conditioning', 'Same time every rep', { equipment: cones }),
    ] },
    games: { name: '4v4 + GKs, 40 × 30 m', where: 'outdoor', sprintMetres: 0, drills: [
      d('4v4 plus goalkeepers', '4', '6 min', '3 min', 2160, 'conditioning', 'Match stamina before matches start', { equipment: [...ball, ...cones, 'goal'], touches: 240, intensity: 'high' }),
    ] },
    strength: { name: 'Power', where: 'indoor', sprintMetres: 0, drills: [
      d('Jump squat', '3', '8', '60 s', 360, 'power', 'Land soft, reset, go again'),
      d('Single-leg squat to bench', '3', '6 each', '60 s', 420, 'strength', 'Knee over the second toe', { equipment: ['bench'] }),
      d('Push-up to clap push-up', '3', '8', '60 s', 360, 'strength', 'Hands leave the floor, land quiet'),
      d('Nordic curl eccentric', '3', '6', '90 s', 450, 'strength', 'Fight it all the way down', { equipment: ['partner'] }),
      d('Copenhagen side plank', '3', '20 s each side', '45 s', 300, 'core', 'Squeeze the top leg into the bench', { equipment: ['bench'] }),
      d('Hurdle hops, 30–40 cm', '4', '5', '60 s', 300, 'power', 'Land where you took off', { equipment: hurdles }),
      d('Bounding for distance', '4', '30 m', '60 s', 360, 'power', 'Hang in the air'),
    ] },
  },
  {
    speedA: { name: 'Resisted sprints', where: 'outdoor', sprintMetres: 190, drills: [
      d('Band or sled sprint, under 10% bodyweight', '5', '20 m', '2–3 min', 840, 'power', 'Same shape as the flat', { intensity: 'high', equipment: ['sled or band'] }),
      d('Flat sprint contrast', '3', '30 m', '3 min', 600, 'speed', 'Feel how light it is', { intensity: 'high', equipment: cones }),
    ] },
    speedB: { name: 'Transition games', where: 'outdoor', sprintMetres: 0, drills: [
      d('2v2 transition game, 30 × 20 m', '8', '30 s', '90 s', 960, 'agility', 'Any turnover is a sprint the other way', { intensity: 'high', equipment: [...ball, ...cones], touches: 80 }),
      d('Sprint', '3', '30 m', '3 min', 600, 'speed', 'Tall, relaxed face, fast feet down', { intensity: 'high', equipment: cones }),
    ] },
    stamina: { name: 'Interval 200s', where: 'outdoor', sprintMetres: 0, drills: [
      d('200 m at 80%', '9', '200 m', '90 s', 1350, 'conditioning', 'Same time every rep', { equipment: cones }),
    ] },
    games: { name: '4v4 + GKs, 40 × 30 m', where: 'outdoor', sprintMetres: 0, drills: [
      d('4v4 plus goalkeepers', '4', '6 min', '3 min', 2160, 'conditioning', 'Match stamina before matches start', { equipment: [...ball, ...cones, 'goal'], touches: 240, intensity: 'high' }),
    ] },
    strength: { name: 'Power', where: 'indoor', sprintMetres: 0, drills: [
      d('Jump squat', '3', '8', '60 s', 360, 'power', 'Land soft, reset, go again'),
      d('Single-leg squat to bench', '3', '6 each', '60 s', 420, 'strength', 'Knee over the second toe', { equipment: ['bench'] }),
      d('Push-up to clap push-up', '3', '8', '60 s', 360, 'strength', 'Hands leave the floor, land quiet'),
      d('Nordic curl eccentric', '3', '6', '90 s', 450, 'strength', 'Fight it all the way down', { equipment: ['partner'] }),
      d('Copenhagen side plank', '3', '20 s each side', '45 s', 300, 'core', 'Squeeze the top leg into the bench', { equipment: ['bench'] }),
      d('Single-leg hop and stick', '3', '5 each', '60 s', 360, 'power', 'Stick it, hold 2 seconds'),
      d('Depth jump to vertical, 40 cm box', '1', '6', '45 s', 300, 'power', 'Touch and go', { equipment: ['box'] }),
    ] },
  },
  {
    speedA: { name: 'Hills to 40 m', where: 'outdoor', sprintMetres: 290, drills: [
      d('Hill sprint, 5–8% grade', '4', '30 m', '3 min, walk down', 780, 'power', 'Big push, big arms', { intensity: 'high' }),
      d('Flat sprint', '3', '30 m', '3 min', 600, 'speed', 'Same shape as the hill, faster feet', { intensity: 'high', equipment: cones }),
      d('3-point start', '2', '40 m', '3 min', 420, 'speed', 'Push the ground away behind you', { intensity: 'high', equipment: cones }),
    ] },
    speedB: { name: 'Curved runs', where: 'outdoor', sprintMetres: 120, drills: [
      d('Bend sprint around a 10 m arc', '6', 'each direction', '90 s', 1080, 'agility', 'Lean into the arc from the ankles', { intensity: 'high', equipment: cones }),
      d('3v3 with a 20 m sprint to a target after every score', '4', '3 min', '90 s', 1080, 'agility', 'Score, then sprint — no celebration', { intensity: 'high', equipment: [...ball, ...cones], touches: 120 }),
    ] },
    stamina: { name: 'Interval 200s', where: 'outdoor', sprintMetres: 0, drills: [
      d('200 m at 80%', '10', '200 m', '90 s', 1500, 'conditioning', 'Same time every rep', { equipment: cones }),
    ] },
    games: { name: '4v4 + GKs, 40 × 30 m', where: 'outdoor', sprintMetres: 0, drills: [
      d('4v4 plus goalkeepers', '4', '6 min', '3 min', 2160, 'conditioning', 'Match stamina before matches start', { equipment: [...ball, ...cones, 'goal'], touches: 240, intensity: 'high' }),
    ] },
    strength: { name: 'Power', where: 'indoor', sprintMetres: 0, drills: [
      d('Jump squat', '3', '8', '60 s', 360, 'power', 'Land soft, reset, go again'),
      d('Single-leg squat to bench', '3', '6 each', '60 s', 420, 'strength', 'Knee over the second toe', { equipment: ['bench'] }),
      d('Nordic curl eccentric', '3', '6', '90 s', 450, 'strength', 'Fight it all the way down', { equipment: ['partner'] }),
      d('Copenhagen side plank', '3', '20 s each side', '45 s', 300, 'core', 'Squeeze the top leg into the bench', { equipment: ['bench'] }),
      d('Hurdle hops, 40 cm', '4', '5', '60 s', 300, 'power', 'Land where you took off', { equipment: hurdles }),
      d('Bounding for distance', '4', '30 m', '60 s', 360, 'power', 'Hang in the air'),
      d('Single-leg hop and stick', '3', '5 each', '60 s', 360, 'power', 'Stick it, hold 2 seconds'),
      d('Depth jump to vertical, 40 cm box', '1', '6', '45 s', 300, 'power', 'Touch and go', { equipment: ['box'] }),
    ] },
  },
];

/** In-season every block is the same: the point is to not change anything. */
const inseasonBlock: BlockSessions = {
  speedA: { name: 'Keep the speed', where: 'outdoor', sprintMetres: 120, drills: [
    d('3-point start', '3', '20 m', '2 min', 400, 'speed', 'Push the ground away behind you', { intensity: 'high', equipment: cones }),
    d('Flying 20 m, 25 m build-in', '3', '45 m', '3 min', 600, 'speed', 'Hit top speed, then let it ride', { intensity: 'high', equipment: cones }),
    d('Hill sprint', '2', '20 m', '2 min, walk down', 300, 'power', 'Big push, big arms', { intensity: 'high' }),
  ] },
  speedB: { name: 'Sharpen', where: 'outdoor', sprintMetres: 60, drills: [
    d('5-10-5 shuttle', '4', '20 m', '90 s', 400, 'agility', 'Plant outside the hip, chest over the knee', { intensity: 'high', equipment: cones }),
    d('1v1 to goal', '4', 'each role', '90 s', 480, 'agility', 'Attack the defender’s front foot', { intensity: 'high', equipment: [...ball, 'goal'], touches: 30 }),
    d('Sprint', '2', '30 m', '3 min', 400, 'speed', 'Tall, relaxed face, fast feet down', { intensity: 'high', equipment: cones }),
    d('Tempo run at 70%', '8', '60 m', 'walk back', 720, 'conditioning', 'Smooth and easy', { equipment: cones }),
  ] },
  stamina: { name: 'Tempo 60s', where: 'outdoor', sprintMetres: 0, drills: [
    d('Tempo run at 70%', '8', '60 m', 'walk back', 720, 'conditioning', 'Keeps the engine, costs no recovery', { equipment: cones }),
  ] },
  games: { name: 'Match day', where: 'outdoor', sprintMetres: 0, drills: [
    d('Match, or 4v4 if there is no match', '1', '60 min', '-', 3600, 'conditioning', 'Play', { equipment: ball, touches: 100, intensity: 'high' }),
  ] },
  strength: { name: 'Maintain', where: 'indoor', sprintMetres: 0, drills: [
    d('Split squat, single-leg RDL, Nordic eccentric', '2', '8 / 8 / 5', '60 s', 600, 'strength', 'Quality, not fatigue', { equipment: ['partner'] }),
    d('Copenhagen side plank', '2', '20 s each side', '45 s', 200, 'core', 'Squeeze the top leg in', { equipment: ['bench'] }),
    d('Pogo hops', '2', '20', '45 s', 120, 'power', 'Stiff ankles, quiet feet'),
    d('Low hurdle hops, 15 cm', '2', '6', '60 s', 160, 'power', 'Land where you took off', { equipment: hurdles }),
  ] },
};
const INSEASON: BlockSessions[] = [inseasonBlock, inseasonBlock, inseasonBlock];

const BY_PHASE: Record<PhaseId, BlockSessions[]> = {
  foundation: FOUNDATION, build: BUILD, power: POWER, inseason: INSEASON,
};

const KINDS: SpeedSessionKind[] = ['speedA', 'stamina', 'speedB', 'strength', 'games'];
const DAY: Record<SpeedSessionKind, string> = { speedA: 'Mon', stamina: 'Tue', speedB: 'Thu', strength: 'Fri', games: 'Sat' };

/** Every session in the program, in week order within each block. */
export const SPEED_SESSIONS: SpeedSession[] = PHASES.flatMap((phase) =>
  BY_PHASE[phase.id].flatMap((blockSessions, bi) =>
    KINDS.map((kind) => {
      const s = blockSessions[kind];
      return {
        id: `speed__${phase.id}__b${bi + 1}__${kind}`,
        phase: phase.id, block: (bi + 1) as 1 | 2 | 3, kind,
        name: s.name, day: DAY[kind], where: s.where,
        drills: s.drills, sprintMetres: s.sprintMetres,
      };
    })));

export const speedSessionById = (id: string) => SPEED_SESSIONS.find((s) => s.id === id);

export function sessionsFor(phase: PhaseId, block: 1 | 2 | 3) {
  return SPEED_SESSIONS.filter((s) => s.phase === phase && s.block === block);
}

/** Speed sessions warm up; stamina, games and strength have their own first drill. */
export function warmsUp(s: SpeedSession) {
  return s.kind === 'speedA' || s.kind === 'speedB';
}

export function sessionDrills(s: SpeedSession): SpeedDrill[] {
  return warmsUp(s) ? [...WARMUP, ...s.drills] : s.drills;
}

export function sessionSeconds(s: SpeedSession) {
  return sessionDrills(s).reduce((a, x) => a + x.seconds, 0);
}

/**
 * The adapter. A speed drill becomes an Exercise so the Runner can play it,
 * tick it, time it and save it, with no video and (mostly) no touches. Ids are
 * stable per session + position, so history can name what was done.
 */
export function asExercise(s: SpeedSession, drill: SpeedDrill, i: number): Exercise {
  // The player's version of the drill, where it's been written: a plain name,
  // the steps, how hard. See speed-guide.ts. Unwritten drills keep the coach's
  // name and just the cue, as before.
  const found = guideFor(drill.name);
  const g = found?.guide;
  const fill = (t: string) => t
    .replace('{sets}', drill.sets).replace('{reps}', drill.reps).replace('{rest}', plainRest(drill.rest));
  return {
    id: `${s.id}__d${String(i + 1).padStart(2, '0')}`,
    session_id: s.id,
    program_id: `speed__${s.phase}`,
    name: g ? (found!.detail ? `${g.plain} (${found!.detail})` : g.plain) : drill.name,
    also_called: g?.coach,
    how: g?.how,
    effort: g?.effort,
    amount: g?.amount ? fill(g.amount) : undefined,
    exercise_order: i + 1,
    sets: drill.sets,
    reps_time: drill.reps,
    rest: plainRest(drill.rest),
    total_seconds: drill.seconds,
    work_seconds: Math.round(drill.seconds * 0.4),
    total_minutes: Math.round(drill.seconds / 6) / 10,
    touches: drill.touches ?? 0,
    touches_per_min: drill.touches ? Math.round((drill.touches / (drill.seconds / 60)) * 10) / 10 : 0,
    primary_focus: drill.focus,
    focus_areas: [drill.focus],
    equipment: drill.equipment ?? [],
    intensity: drill.intensity ?? 'moderate',
    space_required: s.where === 'indoor' ? 'small_area' : 'half_pitch',
    can_do_at_home: s.where !== 'outdoor',
    gym_required: false,
    level: 'any',
    category: 'Speed',
    // A demonstration: the drill's own clip, or a YouTube search for it.
    // The Runner's play button shows whenever this is set.
    video_url: demoUrl(drill.name),
    duration_confidence: 'medium',
    cue: drill.cue,
  };
}

export const sessionExercises = (s: SpeedSession) => sessionDrills(s).map((dr, i) => asExercise(s, dr, i));

/* ---- test day --------------------------------------------------------------- */

export interface SpeedTest {
  id: string;
  name: string;
  how: string;
  measures: string;
  unit: 's' | 'cm';
  /** A better result is a lower number for every timed test. */
  lowerIsBetter: boolean;
  /** What counts as a real step forward in one block. */
  goodProgress: string;
}

export const TESTS: SpeedTest[] = [
  { id: 't10', name: '10 m sprint', unit: 's', lowerIsBetter: true, measures: 'Acceleration',
    how: '3-point start, 2 attempts, best counts. Phone timer app or two stopwatches at both lines.', goodProgress: '0.02–0.05 s' },
  { id: 't20', name: '20 m sprint', unit: 's', lowerIsBetter: true, measures: 'Acceleration',
    how: 'Same runs as the 10 m, timed at the 20 m line.', goodProgress: '0.02–0.05 s' },
  { id: 'fly20', name: 'Flying 20 m', unit: 's', lowerIsBetter: true, measures: 'Max velocity',
    how: '25 m build-in, time the 20 m zone, 2 attempts.', goodProgress: '0.02–0.05 s' },
  { id: 'shuttle', name: '5-10-5 shuttle', unit: 's', lowerIsBetter: true, measures: 'Change of direction',
    how: 'Best of 2, one each direction.', goodProgress: '0.05–0.10 s' },
  { id: 'slj', name: 'Standing long jump', unit: 'cm', lowerIsBetter: false, measures: 'Leg power',
    how: '3 attempts, best, toes to heels.', goodProgress: '3–5 cm' },
  { id: 'rsa', name: 'RSA total, 6 × 30 m', unit: 's', lowerIsBetter: true, measures: 'Repeat sprint ability',
    how: '6 × 30 m with 20 s rest. Add the six times. Total time is the score; drop-off is a note.', goodProgress: '1–3%' },
];

export const HEIGHT_TEST = { id: 'height', name: 'Standing height', unit: 'cm',
  how: 'Shoes off, heels together. A gain of more than 2.5 cm in a block means a growth spurt — see growth rules.' } as const;

/** What a result changes in the next block. Shown on the test screen. */
export const PROGRESSION = [
  { result: 'Sprint times improved', change: 'Add 5 m to the main sprint distance, or one rep — not both.' },
  { result: 'Sprint times flat (within 0.02 s)', change: 'Same distances; swap the top-speed drill set for the next block’s.' },
  { result: 'Sprint times slower', change: 'Cut sprint volume by 25%, keep intensity, check sleep and growth. Re-test in 2 weeks.' },
  { result: 'Flying 20 m improved', change: 'Move wicket and stick spacing up 10 cm.' },
  { result: '5-10-5 improved', change: 'Progress from pre-planned to reactive cuts.' },
  { result: 'Long jump up 5 cm or more', change: 'Raise hurdle height one step: 15 → 20 → 30 → 40 cm.' },
  { result: 'RSA total down 2% or more', change: 'Add a set to the Tuesday RSA runs.' },
  { result: 'RSA total up', change: 'Hold sprint work; add a second tempo run each week for the block.' },
  { result: 'Height up more than 2.5 cm', change: 'Growth spurt: cut sprint volume by a third, plyometrics back to Phase 1 level, double the mechanics drills, for 2–3 blocks.' },
];

/* ---- growth, load and safety -------------------------------------------------- */

export const LOAD_RULES = [
  'No more than 3 high-intensity days (speed, plyo, match) in a row.',
  'A sprint rep is over the moment form breaks. Three breaks in a row ends the sprint section for the day.',
  'Add volume or intensity in a block, never both.',
  'Two matches in a week means one speed session, not two. Three matches means zero.',
  'Speed work happens on the freshest day, never the day before or after a match.',
];

export const GROWTH_RULES = [
  'Keep speed sessions, but cut sprint volume by a third. Times go flat or backwards; that is normal, and the card should say so.',
  'Drop plyometrics back to Phase 1 level (pogos, 15 cm hurdles) whatever the phase.',
  'Double the mechanics drills: wall drills, A-skips, stick runs. Long limbs need re-coordinating.',
  'Stop the session for pain below the kneecap, at the heel, or in the groin. Those are growth-plate complaints; rest beats pushing through every time.',
];

export const RED_FLAGS = [
  { sign: 'Pain that changes how they run', action: 'Stop sprinting that day; see a physio if it lasts a week.' },
  { sign: 'Limping after a session', action: 'No speed work until walking is pain-free.' },
  { sign: 'Slower two blocks in a row, no growth spurt', action: 'Check sleep, food and outside load; cut volume 25%.' },
  { sign: 'Repeated hamstring tightness', action: 'Nordic curls 3× a week at 3×5; no flying sprints until it clears.' },
  { sign: 'Dreading test day', action: 'Overload, not laziness. A week off from speed work.' },
];

/* ---- the science ------------------------------------------------------------- */

export interface Source {
  element: string;
  finding: string;
  cite: string;
  url: string;
}

export const SOURCES: Source[] = [
  { element: '2–3 short speed sessions a week, 20 m sprints, 90 s+ rest',
    finding: 'Sprint training is moderately effective in male youth 10–18 (ES 1.01). The authors recommend twice-weekly sessions of up to 16 sprints of about 20 m with 90 s or more rest — the dose this program uses.',
    cite: 'Moran et al. 2017, Int J Sports Med', url: 'https://pure.hartpury.ac.uk/en/publications/variation-in-responses-to-sprint-training-in-male-youth-athletes-/' },
  { element: 'Sprint training in academy footballers',
    finding: '16 × 20 m once a week improved 10 m, 20 m and 5-10-5 times in pre-PHV players at two professional academies (ES ~1.5).',
    cite: 'Moran et al. 2018, J Sci Med Sport', url: 'https://repository.essex.ac.uk/20408/' },
  { element: 'Mechanics and plyometrics first, resistance later',
    finding: 'Plyometric training had the largest effect on sprint times before and during the growth spurt; combined methods worked best after it.',
    cite: 'Rumpf et al. 2012, Pediatric Exercise Science', url: 'https://lida.sport-iat.de/ta/Record/4026313?lng=en' },
  { element: 'Sled and resisted sprints only from Phase 3',
    finding: 'Sled towing improved 30 m sprint in mid- and post-PHV athletes but not in pre-PHV athletes.',
    cite: 'Rumpf et al., Cardiff Met', url: 'https://pure.cardiffmet.ac.uk/en/publications/the-effect-of-resisted-sprint-training-on-maximum-sprint-kinetics/' },
  { element: 'Plyometrics improve sprint, jump and ball skills',
    finding: 'Plyometric-jump training improved strength, linear sprint, horizontal jump, reactive strength and soccer kicking and dribbling speed versus controls, with similar effects pre- and post-PHV. Evidence certainty rated low.',
    cite: 'Ramirez-Campillo, Moran et al. 2023, Sports Med Open', url: 'https://doaj.org/article/72dab1a5b9214625af15eaaf07663ca4' },
  { element: 'Modest plyo volumes at 13–16',
    finding: 'Jump-height response to plyometrics is lowest in the 13–15.99 group (ES 0.47) despite more training exposure; coaches should adjust volume in that window.',
    cite: 'Moran et al. 2017, J Strength Cond Res', url: 'https://pure.hartpury.ac.uk/en/publications/age-related-variation-in-male-youth-athletes-countermovement-jump/' },
  { element: 'Repeat sprint training with 20–30 s rest',
    finding: '6 × 30 m with 15 or 30 s rest for 5 weeks in-season cut the RSA decrement by about 30% and improved 20 m sprint 2.7% (30 s rest group).',
    cite: 'Iaia et al. 2017, PLOS ONE', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5310862' },
  { element: 'RSA test scored on total time',
    finding: 'In 21 professional players, mean sprint time tracked fitness and body composition; the percentage decrement did not relate to RSA performance.',
    cite: 'Pareja-Blanco et al. 2016, J Hum Kinet', url: 'https://johk.pl/?p=4049' },
  { element: 'Small-sided games for stamina',
    finding: 'Aerobic strain is highest in 2v2 to 4v4 formats at about 100–150 m² per player; the field sizes here sit in that range.',
    cite: 'Umbrella review, Biol Sport 2026', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC13617480/' },
  { element: 'Train by maturity, not birthday',
    finding: 'Most physical qualities are trainable across childhood and adolescence; emphasis shifts with maturation and strength underpins the rest.',
    cite: 'Lloyd & Oliver 2012, Youth Physical Development model', url: 'https://britishjudo.org.uk/wp-content/uploads/2024/10/LTAD-Youth-Physical-Development.pdf' },
  { element: 'Measure height every test day',
    finding: 'Traumatic injuries rose from 0.81 to 1.41 per player in the growth-spurt year and days missed doubled; the authors recommend monthly height monitoring.',
    cite: 'van der Sluis et al. 2014, Int J Sports Med', url: 'https://research.hanze.nl/en/publications/sport-injuries-aligned-to-peak-height-velocity-in-talented-pubert/' },
  { element: 'Late maturers need extra care at 13.5–14.5',
    finding: 'Later-maturing players had far more overuse injuries in the year before and the year of the growth spurt (3.53 vs 0.49 per 1000 h).',
    cite: 'van der Sluis et al. 2015', url: 'https://research.hanze.nl/en/publications/importance-of-peak-height-velocity-timing-in-terms-of-injuries-in/' },
  { element: 'Sleep 8+ hours',
    finding: 'Athletes sleeping under 8 h were 1.7× more likely to be injured; sleep and school grade were the two strongest predictors.',
    cite: 'Milewski et al. 2014, J Pediatr Orthop', url: 'https://www.naseinc.com/blog/less-sleep-increases-injury-potential-in-adolescent-athletes/' },
];

export const CAVEATS = [
  'Pre-PHV sprint response: the 2017 meta-analysis found a weak or negative effect before the growth spurt; the 2018 academy study found a strong one. The mechanics-first design covers both.',
  'Plyometric certainty: the 2023 meta-analysis rates its own evidence low to very low (GRADE). The direction is consistent; the size is not settled.',
  'No study has tested this exact 12-month structure. Academy programs rest on the same component evidence plus practice; the block tests are the trial.',
];
