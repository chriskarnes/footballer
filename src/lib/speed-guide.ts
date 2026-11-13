/**
 * How to do each speed drill, written for the player.
 *
 * speed.ts names drills the way a coach does — "A-skip and B-skip", "Pogo
 * hops", "3-point start" — and gives one cue. That's enough for someone who
 * already knows the drill and nothing for a 13-year-old who doesn't, and
 * unlike the library these drills have no video. So each drill gets, from
 * here:
 *
 *   plain    what to call it, in words a player would use
 *   coach    the coach's name for it, when different — they'll hear it at
 *            training, so it's taught rather than hidden
 *   how      2–4 short steps: what to actually do
 *   effort   one word from a fixed scale, instead of "at 70%" — nobody that
 *            age can feel 70% of their top speed
 *   amount   only where "3 × 20 m" doesn't read: bundles of exercises
 *
 * Written for a 12–14 reading age: short sentences, "you", no word that
 * isn't explained by the step it's in. The program is for 13–16; the
 * writing aims a little younger so every player in it can read it.
 *
 * Keyed by the drill's name in speed.ts. A name with a detail after a comma
 * ("Stick run, 1.2 m spacing") finds the entry for the part before it, and
 * the detail is kept on the plain name. Portable: no React, no Next.
 */

export type Effort = 'easy' | 'steady' | 'fast' | 'max';

/** One scale for every drill, so "Steady" means the same thing on day 1 and
 *  week 40. */
export const EFFORT: Record<Effort, { label: string; means: string }> = {
  easy:   { label: 'Easy',     means: 'Gentle. You could chat the whole time.' },
  steady: { label: 'Steady',   means: 'Working, but you can still talk in short sentences.' },
  fast:   { label: 'Fast',     means: 'Quick, but you’re in control.' },
  max:    { label: 'Flat out', means: 'As fast as you can go.' },
};

export interface DrillGuide {
  plain: string;
  coach?: string;
  how: string[];
  effort: Effort;
  /** {sets}, {reps} and {rest} are filled from the drill. */
  amount?: string;
  /** Leave off the detail after the comma in the drill's name. For details
   *  that are jargon ("5–8% grade") and are explained in the steps instead. */
  dropDetail?: boolean;
  /** A filmed demonstration of this drill. Until there is one, demoUrl()
   *  opens a YouTube search for it. */
  video?: string;
  /** What to search for, when the coach's name alone would not find it
   *  ("Raise" finds nothing; "dynamic warm up jog shuffle carioca" does). */
  search?: string;
}

export const GUIDE: Record<string, DrillGuide> = {
  /* ---- warm-up: every speed session ---- */
  'Raise: jog, shuffle, backpedal, carioca': {
    video: 'https://www.youtube.com/watch?v=Igh4M6IQHFI',
    plain: 'Warm-up 1: get moving', coach: 'Raise', effort: 'easy',
    search: 'dynamic warm up jog side shuffle backpedal carioca',
    amount: '20 m of each, one after the other',
    how: [
      'Jog 20 m.',
      'Side-shuffle 20 m. Stay low and don’t let your feet cross.',
      'Run backwards 20 m with small, quick steps.',
      'Carioca 20 m: move sideways, crossing your back foot in front, then behind. Come back leading with the other side.',
    ],
  },
  'Activate: glute bridge, ring walks, single-leg balance, calf raise': {
    video: 'https://www.youtube.com/watch?v=n6JiF2jp2Ns',
    plain: 'Warm-up 2: wake your muscles up', coach: 'Activate', effort: 'easy',
    search: 'glute bridge single leg balance calf raise warm up',
    amount: 'Each one once, in this order',
    how: [
      'Glute bridge × 10: lie on your back with your knees bent. Push your hips up and squeeze your bum at the top.',
      'Ring walks × 10: walk through the rings on the front of your feet, one foot in each ring.',
      'Balance on one leg for 20 seconds, knee slightly bent and hips level. Then the other leg.',
      'Calf raises × 15: rise up onto your toes slowly, then lower slowly.',
    ],
  },
  'Mobilize: walking lunge with twist, leg swings, inchworm, hip opener': {
    video: 'https://www.youtube.com/watch?v=ZdjbHDobyPc',
    plain: 'Warm-up 3: loosen up', coach: 'Mobilize', effort: 'easy',
    search: 'walking lunge twist leg swings inchworm hip opener warm up',
    amount: 'Each one once, in this order',
    how: [
      'Walking lunges with a twist × 8: step into a lunge, then turn your upper body towards your front leg.',
      'Leg swings × 10 each leg: hold something steady and swing one leg forwards and back.',
      'Inchworms × 5: bend down, hands on the floor, walk your hands out to a push-up position, then walk your feet up to your hands.',
      'Hip openers × 8 each leg: walking forward, lift your knee and circle it out to the side.',
    ],
  },
  'Potentiate: A-skip, B-skip, high knees, straight-leg bound': {
    video: 'https://www.youtube.com/watch?v=PcWsOM144xo',
    plain: 'Warm-up 4: fast drills', coach: 'Potentiate', effort: 'steady',
    amount: '20 m of each, twice through',
    how: [
      'High-knee skip: skip forward, lifting one knee to hip height, toes pulled up.',
      'Leg-reach skip: the same, but straighten the leg out in front, then pull it down and back under you.',
      'High knees: run on the spot moving forward slowly, knees up fast.',
      'Straight-leg bounds: keep your legs almost straight and bounce forward off the front of your feet.',
    ],
  },
  'Build-up runs to 90%': {
    plain: 'Build-up runs', effort: 'fast',
    how: [
      'Start with a jog.',
      'Get a bit faster every few steps.',
      'By the last 10 m you’re close to top speed, but still relaxed.',
      'Walk back. That’s your rest.',
    ],
  },

  /* ---- Foundation ---- */
  'Wall drill': {
    video: 'https://www.youtube.com/watch?v=Qt6q--Lx4KM',
    plain: 'Wall drill', effort: 'steady',
    how: [
      'Lean into a wall with your hands at shoulder height and your arms straight. Your body is a straight line from head to heels.',
      'Lift one knee until your thigh is level with your hip, toes pulled up.',
      'Hold for 10 seconds, then swap legs.',
    ],
  },
  'Falling start': {
    video: 'https://www.youtube.com/watch?v=3X4hDM7T95g',
    plain: 'Falling starts', effort: 'max',
    how: [
      'Stand tall at the line, feet together, up on your toes.',
      'Lean forward from your ankles. Keep your body straight, like a plank tipping over.',
      'Just before you’d fall, sprint. Run all the way through the cone.',
    ],
  },
  '2-point start': {
    video: 'https://www.youtube.com/watch?v=96Idqyl7_1U',
    plain: 'Standing sprint start', coach: '2-point start', effort: 'max',
    how: [
      'One foot just behind the line, the other a foot-length back.',
      'Bend your knees a little and lean forward. The arm opposite your front foot goes forward.',
      'Push hard off both feet and sprint through the cone. Stay low for your first few steps.',
    ],
  },
  '3-point start': {
    video: 'https://www.youtube.com/watch?v=-Ihg0il6gtw',
    plain: 'Sprint start, one hand down', coach: '3-point start', effort: 'max',
    how: [
      'Front foot just behind the line, back foot a foot-length behind it.',
      'Bend down and put one hand on the ground behind the line — the hand opposite your front foot. Hips a little higher than your shoulders.',
      'Push off hard and drive your arms. Stay low for the first steps, then come up tall.',
    ],
  },
  'Ankling and dribbles': {
    video: 'https://www.youtube.com/watch?v=es_7EB9ki8w',
    plain: 'Quick-feet walks', coach: 'Ankling and dribbles', effort: 'steady',
    how: [
      'Walk forward taking tiny steps with your legs almost straight.',
      'Land on the front of your foot and push off fast, like the ground is hot.',
      'As you go, let your heel come up higher — to your other ankle, then your shin — while keeping the steps quick.',
    ],
  },
  'A-march and A-skip': {
    video: 'https://www.youtube.com/watch?v=c8il_EjiBWQ',
    plain: 'High-knee march, then skip', coach: 'A-march and A-skip', effort: 'steady',
    how: [
      'March: lift one knee to hip height with your toes pulled up, then push that foot down under your hip. Swap legs.',
      'Swing your arms like you do when you run.',
      'Halfway, turn the march into a skip — the same movement with a little hop between steps.',
    ],
  },
  'A-skip and B-skip': {
    video: 'https://www.youtube.com/watch?v=PcWsOM144xo',
    plain: 'Skips: high knee, then leg reach', coach: 'A-skip and B-skip', effort: 'steady',
    how: [
      'High-knee skip: skip forward, lifting one knee to hip height, toes pulled up. Snap the foot down under your hip.',
      'Leg-reach skip: the same, but after the knee comes up, straighten the leg out in front, then pull it down and back under you.',
      'High-knee skip one way, leg-reach skip on the way back.',
    ],
  },
  'Low hurdle step-overs': {
    video: 'https://www.youtube.com/watch?v=tNUOffrxRSA',
    plain: 'Mini-hurdle step-overs', effort: 'steady',
    how: [
      'Set out 6 mini hurdles about one step apart.',
      'Walk over them, lifting each knee high so your foot clears the hurdle.',
      'Put each foot down under your hip, not out in front of you.',
    ],
  },
  'Stick run': {
    video: 'https://www.youtube.com/watch?v=-tO48It7GUY',
    plain: 'Run through sticks', effort: 'fast',
    how: [
      'Lay 6 sticks or flat markers on the ground, spaced as shown.',
      'Take a few steps of run-up so you’re moving when you reach the first stick.',
      'Run through with one step between each stick, quick and on the front of your feet.',
    ],
  },
  'Agility ring quick feet: in-in-out': {
    video: 'https://www.youtube.com/watch?v=l-h5lJIzRw4',
    plain: 'Quick feet through rings', coach: 'In-in-out', effort: 'fast',
    how: [
      'Lay 6 rings in a line and stand side-on to them.',
      'Step both feet into the first ring, then one foot out, then into the next ring.',
      'Go down the line as fast as you can without touching a ring. Come back leading with the other foot.',
    ],
  },
  'Partner push-release start': {
    video: 'https://www.youtube.com/watch?v=etF5mQT-UyU',
    plain: 'Partner-held sprint start', coach: 'Push-release start', effort: 'max',
    how: [
      'Put a towel around your waist. Your partner stands behind you holding both ends.',
      'Lean forward into the towel and march on the spot, pushing against your partner.',
      'After 2–3 seconds your partner lets go. Sprint to the cone.',
    ],
  },
  'Sprint': {
    plain: 'Sprint', effort: 'max',
    how: [
      'Start standing, one foot forward.',
      'Sprint flat out through the cone.',
      'Walk back and take all of your rest — sprints only make you faster when you’re fresh.',
    ],
  },
  'Lying-start get-up': {
    plain: 'Get up and sprint', coach: 'Lying start', effort: 'max',
    how: [
      'Lie face down behind the line, hands by your chest.',
      'When you’re ready (or on a partner’s “go”), get up as fast as you can and sprint.',
      'Your first step should already be a sprinting step — no little stutter.',
    ],
  },
  'Standing start': {
    video: 'https://www.youtube.com/watch?v=96Idqyl7_1U',
    plain: 'Standing start', effort: 'max',
    how: [
      'Stand behind the line with one foot forward.',
      'Lean a little and go.',
      'Stay low for your first 6 steps, then come up tall. Run through the cone.',
    ],
  },
  'Sprint with 5 m fly-in': {
    plain: 'Rolling-start sprint', coach: 'Fly-in', effort: 'max',
    how: [
      'Put a cone 5 m before the start line.',
      'Jog to that cone, then speed up so you’re already moving fast at the start line.',
      'Sprint flat out to the end cone, then slow down gradually.',
    ],
  },
  'Tempo run at 70%': {
    video: 'https://www.youtube.com/watch?v=xsMHh9WNDzc',
    plain: 'Steady runs', coach: 'Tempo runs', effort: 'steady',
    how: [
      'Run 60 m at a steady pace — quicker than a jog, nowhere near a sprint.',
      'Walk back to the start. That’s your rest.',
      'Try to make every run take the same time. If the last few are much slower, start slower next time.',
    ],
  },
  '4v4 small-sided game': {
    video: 'https://www.youtube.com/watch?v=CzlZgdRrYhg',
    plain: '4 v 4 game', effort: 'fast',
    how: [
      'Mark a small field about 30 m by 20 m with two small goals or gates.',
      'Play 4 against 4. Rest between games.',
      'Keep moving the whole time: chase the ball when you lose it, find space when your team has it.',
    ],
  },
  'Box squat, split squat, single-leg glute bridge': {
    video: 'https://www.youtube.com/watch?v=REflwhg0jNs',
    plain: 'Leg strength', effort: 'steady',
    amount: '{sets} rounds, {reps} · rest {rest} between rounds',
    how: [
      'Box squat: sit back until you just touch a box or bench, then stand up tall. Knees point the same way as your toes.',
      'Split squat: one foot forward, one back. Lower your back knee towards the floor, then push up. Do all of them, then swap legs.',
      'One-leg bridge: lie on your back, one knee bent, the other leg up. Push your hips up through your heel, then lower slowly. Then the other leg.',
    ],
  },
  'Push-up and plank variations': {
    plain: 'Push-ups and planks', effort: 'steady',
    amount: '{sets} rounds of push-ups, then plank: {reps} · rest {rest}',
    how: [
      'Push-ups: hands under your shoulders, body straight. Lower until your chest is a fist off the floor, then push up. On your knees is fine.',
      'Plank: on your forearms and toes, body straight from head to heels. Hold for the time shown.',
    ],
  },
  'Pogo hops': {
    video: 'https://www.youtube.com/watch?v=c2LBofIzUqs',
    plain: 'Ankle bounces', coach: 'Pogo hops', effort: 'fast',
    how: [
      'Stand tall with your feet hip-width apart.',
      'Bounce on the spot using mostly your ankles. Your knees only bend a little.',
      'Spend as little time on the ground as you can, and land quietly.',
    ],
  },
  'Low hurdle hops': {
    video: 'https://www.youtube.com/watch?v=JMFiIyLLAlk',
    plain: 'Mini-hurdle jumps', effort: 'fast',
    how: [
      'Line up 6 mini hurdles about a stride apart.',
      'Jump over each one with both feet together.',
      'Land softly on the front of your feet, knees over your toes, and go straight into the next jump.',
    ],
  },
  'Skip for height': {
    video: 'https://www.youtube.com/watch?v=iJGycGF-iQE',
    plain: 'Power skips', effort: 'fast',
    how: [
      'Skip forward, driving one knee up and pushing hard off the other foot.',
      'Go for height, not distance. Swing your arms up too.',
      'Land softly and go straight into the next skip.',
    ],
  },
  /* ---- Build, Power and In-season ---- */
  'Flying 10 m, 20 m build-in': {
    video: 'https://www.youtube.com/watch?v=F7BlhM7k5o0',
    plain: 'Flying 10s', coach: 'Flying 10 m', effort: 'max',
    how: [
      'Put out cones at 0 m, 20 m and 30 m.',
      'Use the first 20 m to build up speed.',
      'Hit top speed at the 20 m cone and hold it all the way through the last 10 m. Then ease down.',
    ],
  },
  'Flying 20 m, 25 m build-in': {
    video: 'https://www.youtube.com/watch?v=F7BlhM7k5o0',
    plain: 'Flying 20s', coach: 'Flying 20 m', effort: 'max',
    how: [
      'Put out cones at 0 m, 25 m and 45 m.',
      'Use the first 25 m to build up speed.',
      'Hit top speed at the 25 m cone and hold it through the last 20 m. Then ease down.',
    ],
  },
  'Build-fly-relax': {
    video: 'https://www.youtube.com/shorts/XFvdoTGTFmk',
    plain: 'Build, sprint, float', coach: 'Build-fly-relax', effort: 'max',
    how: [
      'Mark out three 20 m zones in a row.',
      'Zone 1: build up speed. Zone 2: top speed.',
      'Zone 3: relax your face and shoulders and let the speed carry you without forcing it.',
    ],
  },
  'Wicket run': {
    video: 'https://www.youtube.com/watch?v=SYi8CH32ZSA',
    plain: 'Mini-hurdle runs', coach: 'Wicket run', effort: 'fast',
    how: [
      'Put 8 mini hurdles in a line, spaced as shown.',
      'Take a 10–15 m run-up so you arrive at the first hurdle already fast.',
      'Take one step between each hurdle. Step over them, don’t jump, and land with your foot under your hip. Stay tall.',
    ],
  },
  'Hill sprint': {
    video: 'https://www.youtube.com/watch?v=VzHQUh5jzsI',
    plain: 'Hill sprints', effort: 'max', dropDetail: true,
    how: [
      'Find a gentle slope — about as steep as a wheelchair ramp. If you end up clawing on your toes, it’s too steep.',
      'Sprint up it with a big push from each leg and big arm swings.',
      'Walk back down slowly. That’s your rest.',
    ],
  },
  'Flat sprint': {
    plain: 'Flat sprint', effort: 'max',
    how: [
      'Straight after your hill sprints, sprint the distance on flat ground.',
      'Keep the same strong push and big arms you used on the hill, with quicker steps.',
      'Walk back and take all your rest.',
    ],
  },
  'Flat sprint straight after': {
    plain: 'Flat sprint after the hill', effort: 'max',
    how: [
      'Go straight from your hill sprints to flat ground.',
      'Sprint the distance using the same push and arms as on the hill, but with quicker steps.',
    ],
  },
  'Band or sled sprint, under 10% bodyweight': {
    video: 'https://www.youtube.com/watch?v=cFsP42jtBvU',
    plain: 'Sprints pulling a light weight', coach: 'Resisted sprint', effort: 'max',
    how: [
      'Use a light sled, or a band round your waist held by a partner behind you.',
      'Sprint the distance. You should still look like you’re sprinting — if you slow right down or stand up tall, it’s too heavy.',
      'Walk back and take all your rest.',
    ],
  },
  'Flat sprint contrast': {
    plain: 'Flat sprint after the sled', coach: 'Contrast sprint', effort: 'max',
    how: [
      'After your sled or band sprints, take your rest, then sprint with nothing pulling you.',
      'Notice how light and quick you feel. That feeling is the point.',
    ],
  },
  'Bend sprint around a 10 m arc': {
    video: 'https://www.youtube.com/watch?v=Ty01B1O6JZE',
    plain: 'Curved sprints', coach: 'Bend sprint', effort: 'max',
    how: [
      'Put cones in a curve, like the edge of a circle 10 m across.',
      'Sprint around the outside of the cones, staying close to them.',
      'Lean into the curve from your ankles, not your waist. Do one each way.',
    ],
  },
  'Repeat sprints at 90%': {
    video: 'https://www.youtube.com/watch?v=ggF6T7150nA',
    plain: 'Repeat sprints', coach: 'RSA', effort: 'fast', dropDetail: true,
    amount: '{sets} sets of {reps}, 20 s between sprints · rest {rest} between sets',
    how: [
      'Sprint 30 m, nearly flat out.',
      'You have 20 seconds to walk back and go again.',
      'Try to keep every sprint close to your first one. Slowing down a lot means you started too hard.',
    ],
  },
  '200 m at 80%': {
    plain: '200 m runs', coach: '200s', effort: 'fast',
    how: [
      'Run 200 m — quicker than your steady runs, slower than a sprint.',
      'Walk for the rest time.',
      'Aim for the same time on every run.',
    ],
  },
  'Tempo run at 75%': {
    video: 'https://www.youtube.com/watch?v=xsMHh9WNDzc',
    plain: 'Steady 100s', coach: 'Tempo runs', effort: 'steady',
    how: [
      'Run 100 m at a steady pace, a little quicker than your 60 m steady runs.',
      'Walk 100 m back. That’s your rest.',
      'Every run should take about the same time.',
    ],
  },
  '5-10-5 shuttle': {
    video: 'https://www.youtube.com/watch?v=LJcWjNMISc0',
    plain: '5-10-5 shuttle', effort: 'max',
    how: [
      'Put three cones in a line, 5 m apart. Start at the middle one.',
      'Sprint 5 m to one end and touch the line with your hand.',
      'Turn, sprint 10 m to the other end and touch that line, then turn and sprint back through the middle. Start the other way next time.',
    ],
  },
  '45-degree cut': {
    video: 'https://www.youtube.com/watch?v=YyBMVaxWFsM',
    plain: 'Sharp-angle cuts', coach: '45-degree cut', effort: 'max',
    how: [
      'Sprint 5 m to a cone.',
      'Plant your outside foot just past the cone, with your chest over your knee.',
      'Push off and sprint 5 m on a diagonal to the next cone. Do both sides.',
    ],
  },
  'Coach-pointed cut': {
    video: 'https://www.youtube.com/watch?v=TZC-Pl_quoc',
    plain: 'Cut when they point', effort: 'max',
    how: [
      'Run towards your partner or coach.',
      'When they point left or right, plant your foot and sprint 5 m that way.',
      'React to the point — don’t guess early.',
    ],
  },
  'L-drill': {
    video: 'https://www.youtube.com/watch?v=_KtUvR2zcNU',
    plain: 'L-drill', effort: 'max',
    how: [
      'Put three cones in an L shape: two 5 m apart in a line, and the third 5 m to the side of the second.',
      'Sprint to the second cone, touch the ground, and sprint back to the start.',
      'Sprint to the second cone again, go round it to the third, loop round the third, and come back round the second to the start.',
    ],
  },
  'Mirror drill in pairs': {
    video: 'https://www.youtube.com/watch?v=LLVucGoai_E',
    plain: 'Mirror game', effort: 'max',
    how: [
      'Face a partner about 2 m apart.',
      'They move — sideways, forwards, back — and you copy them as fast as you can.',
      'Watch their hips, not their eyes or feet. After 10 seconds, swap who leads.',
    ],
  },
  'Pass and react: receive, turn on a call, sprint 15 m': {
    video: 'https://www.youtube.com/watch?v=vsy2CiHG6A0',
    plain: 'Receive, turn and go', effort: 'max',
    how: [
      'Your partner passes to you.',
      'As the ball arrives they shout “left” or “right”.',
      'Take your first touch away to that side and sprint 15 m with the ball.',
    ],
  },
  'Dribble-sprint: 10 m dribble into 20 m sprint': {
    video: 'https://www.youtube.com/watch?v=LfbPnZmlhto',
    plain: 'Dribble, then sprint', effort: 'max',
    how: [
      'Dribble 10 m with the ball close to your feet.',
      'At the cone, push the ball well ahead with one big touch.',
      'Sprint after it for 20 m.',
    ],
  },
  '20 m sprint onto a played ball, one touch, finish': {
    video: 'https://www.youtube.com/watch?v=mykQ2f4FRwg',
    plain: 'Sprint onto a pass and shoot', effort: 'max',
    how: [
      'Your partner plays the ball into space in front of you.',
      'Sprint 20 m onto it.',
      'One touch to set it, then shoot.',
    ],
  },
  '1v1 shadowing with the ball': {
    video: 'https://www.youtube.com/watch?v=l6TWYB1wRjc',
    plain: '1 v 1 shadowing', effort: 'fast',
    how: [
      'In a small square, one player has the ball and the other defends.',
      'The attacker uses feints and quick changes of direction to try to get free.',
      'The defender stays between the attacker and the far side. Swap after each go.',
    ],
  },
  '1v1 to goal': {
    video: 'https://www.youtube.com/watch?v=ZsQc4ovGOpo',
    plain: '1 v 1 to goal', effort: 'fast',
    how: [
      'One attacker with the ball, one defender, one goal.',
      'The attacker tries to score. The defender tries to win the ball or block the shot.',
      'Swap roles after each go.',
    ],
  },
  '1v1 to goal from a 10 m sprint': {
    video: 'https://www.youtube.com/watch?v=ZsQc4ovGOpo',
    plain: 'Race, then 1 v 1', effort: 'max',
    how: [
      'Two players start side by side, 10 m from a ball.',
      'On “go”, both sprint. Whoever gets there first attacks the goal, and the other defends.',
      'Swap starting sides each time.',
    ],
  },
  '3v3 small-sided game': {
    video: 'https://www.youtube.com/watch?v=CzlZgdRrYhg',
    plain: '3 v 3 game', effort: 'fast',
    how: [
      'Play 3 against 3 on a small field with small goals.',
      'Small field means lots of short sprints. Keep moving.',
      'Rest between games.',
    ],
  },
  '3v3 with a 20 m sprint to a target after every score': {
    plain: '3 v 3, sprint after you score', effort: 'fast',
    how: [
      'Play 3 against 3 on a small field.',
      'When your team scores, everyone on it sprints to a cone 20 m away, then gets straight back into the game.',
      'No celebrating first.',
    ],
  },
  '2v2 transition game': {
    video: 'https://www.youtube.com/watch?v=Wy8BFM0K-TQ',
    plain: '2 v 2 quick-switch game', coach: 'Transition game', effort: 'fast',
    how: [
      'Play 2 against 2 on a small field with two goals, in 30-second bursts.',
      'The moment the ball changes team, both teams switch — attackers sprint back, defenders sprint forward.',
    ],
  },
  '4v4 plus goalkeepers': {
    video: 'https://www.youtube.com/watch?v=CzlZgdRrYhg',
    plain: '4 v 4 with goalkeepers', effort: 'fast',
    how: [
      'Play 4 against 4 with a goalkeeper in each goal.',
      'Play at match pace for the whole game.',
      'Rest between games.',
    ],
  },
  'Match, or 4v4 if there is no match': {
    plain: 'Match day', effort: 'fast',
    how: [
      'Play your match.',
      'No match this week? Play 4 v 4 games instead, with breaks, for about an hour.',
    ],
  },
  'Bounding for distance': {
    video: 'https://www.youtube.com/watch?v=eIjuMzIFREs',
    plain: 'Big bounds', coach: 'Bounding', effort: 'fast',
    how: [
      'Run with long, exaggerated strides — push off one foot and land on the other.',
      'Drive your knee forward and swing your arms big. Try to hang in the air.',
      'Land on the front of your foot, under your body.',
    ],
  },
  'Lateral bound': {
    video: 'https://www.youtube.com/watch?v=niEGdFUQ6sY',
    plain: 'Side jumps on one leg', coach: 'Lateral bound', effort: 'fast',
    how: [
      'Stand on your right leg.',
      'Jump sideways as far as you can and land on your left leg.',
      'Hold still for 2 seconds, then jump back.',
    ],
  },
  'Single-leg hop and stick': {
    video: 'https://www.youtube.com/watch?v=KyKbb1fJntE',
    plain: 'Hop and freeze', coach: 'Hop and stick', effort: 'steady',
    how: [
      'Stand on one leg.',
      'Hop forward and land on the same leg.',
      'Freeze for 2 seconds, knee pointing over your second toe — not caving in.',
    ],
  },
  'Drop and stick': {
    video: 'https://www.youtube.com/watch?v=wV3ozV9mcgo',
    plain: 'Step off and land', coach: 'Drop and stick', effort: 'steady',
    how: [
      'Stand on the box.',
      'Step off — don’t jump.',
      'Land on both feet with your knees bent over your toes, as quietly as you can, and freeze for 2 seconds.',
    ],
  },
  'Depth jump to vertical': {
    video: 'https://www.youtube.com/watch?v=bMHL5xqKn3E',
    plain: 'Drop and jump', coach: 'Depth jump', effort: 'max',
    how: [
      'Stand on the box and step off — don’t jump.',
      'As soon as your feet touch the ground, jump straight up as high as you can.',
      'Spend as little time on the ground as you can. Land softly.',
    ],
  },
  'Hurdle hops': {
    video: 'https://www.youtube.com/watch?v=JMFiIyLLAlk',
    plain: 'Hurdle jumps', effort: 'fast',
    how: [
      'Line up mini hurdles at the height shown, about a stride apart.',
      'Jump over each one with both feet together.',
      'Land softly on the front of your feet and go straight into the next jump.',
    ],
  },
  'Jump squat': {
    plain: 'Jump squats', effort: 'fast',
    how: [
      'Stand with your feet shoulder-width apart and squat halfway down.',
      'Jump as high as you can.',
      'Land softly, settle, then do the next one.',
    ],
  },
  'Standing long jump': {
    video: 'https://www.youtube.com/watch?v=dVgtvAXeBQw',
    plain: 'Standing long jump', effort: 'max',
    how: [
      'Stand at the line with your feet hip-width apart.',
      'Swing your arms back and bend your knees.',
      'Jump forward as far as you can, swinging your arms through. Land on both feet and hold it.',
    ],
  },
  'Push-up to plyo push-up': {
    plain: 'Push-ups, then jumping push-ups', effort: 'fast',
    how: [
      'Do a normal push-up.',
      'Then lower and push up so hard that your hands leave the floor.',
      'Land with soft, bent elbows. On your knees is fine.',
    ],
  },
  'Rear-foot-elevated split squat': {
    video: 'https://www.youtube.com/watch?v=4-qkLYDckys',
    plain: 'Back-foot-up split squat', coach: 'Bulgarian split squat', effort: 'steady',
    how: [
      'Rest the top of your back foot on a bench behind you. Put your front foot well forward.',
      'Lower your back knee towards the floor, keeping your front knee over your toes.',
      'Push back up. Do all of them, then swap legs.',
    ],
  },
  'Single-leg Romanian deadlift': {
    video: 'https://www.youtube.com/watch?v=DPFnfAUCvTA',
    plain: 'One-leg reach', coach: 'Single-leg RDL', effort: 'steady',
    how: [
      'Stand on one leg with the knee slightly bent.',
      'Tip forward from your hips, reaching your other leg straight back, until your body is nearly level. Keep your back flat.',
      'Come back up by squeezing your bum. Do all of them, then swap legs.',
    ],
  },
  'Single-leg squat to bench': {
    video: 'https://www.youtube.com/watch?v=3-ZE3O7qlw8',
    plain: 'One-leg squat to a bench', effort: 'steady',
    how: [
      'Stand in front of a bench on one leg, with the other leg held out in front.',
      'Sit down slowly until you just touch the bench.',
      'Stand back up on the same leg. Keep your knee in line with your second toe.',
    ],
  },
  'Step-up to bench': {
    plain: 'Step-ups', effort: 'steady',
    how: [
      'Put one foot on a bench.',
      'Push through that heel to stand up tall on the bench. Don’t push off your back foot.',
      'Step down slowly. Do all of them, then swap legs.',
    ],
  },
  'Nordic curl eccentric': {
    video: 'https://www.youtube.com/watch?v=mYfTCoOoX74',
    plain: 'Nordic curls (lowering)', coach: 'Nordic curl', effort: 'steady',
    how: [
      'Kneel on something soft. A partner holds your ankles down firmly.',
      'Keep your body straight from knees to head, and lower forwards as slowly as you can.',
      'When you can’t hold it, catch yourself with your hands and push back up.',
    ],
  },
  'Copenhagen side plank': {
    video: 'https://www.youtube.com/watch?v=gsWpUFyVRyM',
    plain: 'Side plank on a bench', coach: 'Copenhagen plank', effort: 'steady',
    how: [
      'Lie on your side next to a bench. Rest the inside of your top knee on it. Use your ankle once that gets easy.',
      'Lift your hips until your body is a straight line, pressing your top leg down into the bench.',
      'Hold for the time shown, then the other side.',
    ],
  },
  'Split squat, single-leg RDL, Nordic eccentric': {
    video: 'https://www.youtube.com/watch?v=REflwhg0jNs',
    plain: 'Leg strength: three exercises', effort: 'steady',
    amount: '{sets} rounds: 8 split squats, 8 one-leg reaches, 5 Nordic curls · rest {rest}',
    how: [
      'Split squat: one foot forward, one back. Lower your back knee towards the floor, then push up. Each leg.',
      'One-leg reach: stand on one leg, tip forward from your hips with your other leg reaching back, back flat. Each leg.',
      'Nordic curl: kneel with a partner holding your ankles and lower forwards as slowly as you can.',
    ],
  },
};

/**
 * Where to see the drill done. The drill's own video when one has been
 * filmed; otherwise a YouTube search for the coach's name of it, which lands
 * on real demonstrations and can never go stale. To film your own: set
 * `video` on the entry and this returns it instead.
 */
export function demoUrl(name: string): string {
  const found = guideFor(name);
  const g = found?.guide;
  if (g?.video) return g.video;
  const base = name.split(',')[0].trim();
  const q = g?.search ?? `${g?.coach ?? base} drill`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/** The guide for a drill, if it has been written yet. */
export function guideFor(name: string): { guide: DrillGuide; detail?: string } | null {
  if (GUIDE[name]) return { guide: GUIDE[name] };
  const [base, ...rest] = name.split(',');
  const g = GUIDE[base.trim()];
  return g ? { guide: g, detail: g.dropDetail ? undefined : rest.join(',').trim() || undefined } : null;
}

/** "60 s" reads as a stopwatch; "1 min" reads as a rest. */
export function plainRest(rest: string): string {
  const m = /^(\d+) s$/.exec(rest.trim());
  if (m && Number(m[1]) % 60 === 0) return `${Number(m[1]) / 60} min`;
  return rest;
}
