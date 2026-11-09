/**
 * Eight sample players for an academy's trainer dashboard, with four weeks of
 * history that tells a story: a couple of stars, some steady, one behind, one
 * badly behind, one gone quiet, one who never started, one with no plan.
 *
 *   npm run seed:demo              # the `demo` academy
 *   npm run seed:demo -- riverside # another academy, by subdomain
 *
 * History is generated relative to today, so re-run it the morning of a demo
 * and "this week" is this week. Safe to re-run: it only ever touches its own
 * sample accounts (demo-*@train.futbol), replacing their plans, sessions and
 * notes each time. They can't sign in; nobody has their inboxes.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const slug = process.argv[2] ?? 'demo';

type Persona = {
  first: string; last: string; age: string; positions: string[]; foot: string;
  /** Planned weekdays, 0 = Monday. Empty: no plan. */
  days: number[];
  /** Share of planned days done in past weeks. */
  rate: number;
  /** This week: how many past planned days to skip, from the most recent back. */
  missThisWeek?: number;
  /** Nothing in the last N days. */
  quiet?: number;
  /** Extra unplanned sessions, as a share of rest days. */
  extra?: number;
  /** No plan: trained this many days ago. */
  casual?: number[];
  never?: boolean;
};

const PLAYERS: Persona[] = [
  { first: 'Sofia', last: 'Martinez', age: '13_15', positions: ['Winger'], foot: 'left', days: [0, 2, 4, 5], rate: 1 },
  { first: 'Liam', last: 'Carter', age: '10_12', positions: ['Centre mid'], foot: 'right', days: [0, 2, 4], rate: 0.85 },
  { first: 'Ava', last: 'Thompson', age: '13_15', positions: ['Striker'], foot: 'right', days: [1, 3, 5], rate: 1, extra: 0.25 },
  { first: 'Noah', last: 'Kim', age: '10_12', positions: ['Centre-back'], foot: 'right', days: [0, 2, 4], rate: 0.8, missThisWeek: 1 },
  { first: 'Mateo', last: 'Silva', age: '16_18', positions: ['Attacking mid'], foot: 'both', days: [0, 1, 3, 4], rate: 0.7, missThisWeek: 9 },
  { first: 'Emma', last: 'Rossi', age: '13_15', positions: ['GK'], foot: 'right', days: [0, 3], rate: 0.9, quiet: 12 },
  { first: 'Jayden', last: 'Brooks', age: 'u10', positions: ['Striker'], foot: 'right', days: [1, 3], rate: 0, never: true },
  { first: 'Olivia', last: 'Chen', age: '10_12', positions: ['Full-back'], foot: 'left', days: [], rate: 0, casual: [2, 5, 9, 13, 16, 20, 24] },
];

const NOTES = [
  { daysAgo: 6, body: 'Great first week everyone. Remember: little and often beats one long session.', all: true, seenBy: 0.7 },
  { daysAgo: 3, body: 'Sofia, that weak-foot work is paying off. Keep it going!', to: ['Sofia'], seenBy: 1 },
];

/**
 * The trainer's own content for the groups demo. Original, generic drills
 * written for this seed: nothing from the licensed library, which other
 * academies can't see.
 */
const DRILLS = [
  { key: 'wall', name: 'Wall passes, both feet', amount: '50 each foot', minutes: 6, focus: 'passing', how: 'Two-touch against a wall from 3 metres.\nControl across your body, then pass.\nStep back a metre when it feels easy.' },
  { key: 'cones', name: 'Five-cone weave', amount: '6 runs', minutes: 5, focus: 'dribbling', how: 'Five cones a stride apart in a line.\nWeave through using only the outside of your foot, then the inside.\nHead up at the last cone.' },
  { key: 'juggle', name: 'Juggling ladder', amount: 'Beat your best', minutes: 5, focus: 'juggling', how: 'Feet only. Count your best run.\nThen try thighs, then alternate feet.' },
  { key: 'turns', name: 'Turn and go', amount: '10 each way', minutes: 6, focus: 'first_touch', how: 'Toss the ball against a wall, check your shoulder, turn with your first touch.\nAccelerate three steps after every turn.' },
  { key: 'finish', name: 'Corner finishing', amount: '20 shots', minutes: 8, focus: 'finishing', how: 'Aim for a target in each bottom corner.\nAlternate feet. Placement over power.' },
  { key: 'tick', name: 'Toe taps and rolls', amount: '3 × 45 s', minutes: 4, focus: 'ball_mastery', how: 'Toe taps on top of the ball, then sole rolls side to side.\nStay on the balls of your feet.' },
];
const PROGRAM = {
  name: 'Foundations', weeks: 8, description: 'Touch, turning and passing at home, two short sessions a week.',
  sessions: [
    { week: 1, name: 'Touch and pass', drills: ['tick', 'wall', 'cones'] },
    { week: 1, name: 'Turn and finish', drills: ['juggle', 'turns', 'finish'] },
    { week: 3, name: 'Both feet', drills: ['tick', 'wall', 'turns'] },
    { week: 3, name: 'Weave and shoot', drills: ['juggle', 'cones', 'finish'] },
  ],
};
const GROUPS = [
  { name: 'U12 Tuesday', weekday: 1, time: '17:30', members: ['Liam', 'Noah', 'Jayden', 'Olivia'], weeksIn: 3 },
  { name: 'Finishing', weekday: 3, time: '18:00', members: ['Ava', 'Mateo', 'Liam'], weeksIn: 1 },
];
/** Group homework done this week, by session index in PROGRAM for the current week. */
const GROUP_DONE: Record<string, number[]> = { Liam: [0, 1], Olivia: [0], Ava: [0] };

// ---------------------------------------------------------------- dates ---
const TZ = 'America/New_York';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dayMs = 86400000;
const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const addDays = (d: string, n: number) => new Date(toUtc(d) + n * dayMs).toISOString().slice(0, 10);
const weekday = (d: string) => (new Date(toUtc(d)).getUTCDay() + 6) % 7;
const monday = addDays(today, -weekday(today));
/** An evening on that day, New York time (≈ 22:00–00:30 UTC). */
const evening = (d: string, salt: number) => new Date(toUtc(d) + (22 * 60 + (salt % 150)) * 60000).toISOString();

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

async function main() {
  const academy = await must(db.from('academies').select('id, name').eq('slug', slug).maybeSingle(), 'academy');
  if (!academy) throw new Error(`No academy "${slug}". Run migrations 0004 and 0005 first.`);

  const sessions = await must(db.from('sessions').select('id, name, total_minutes').limit(60), 'sessions');
  if (!sessions?.length) throw new Error('No library sessions. Run npm run seed first.');

  const owner = await must(db.from('academy_members').select('user_id').eq('academy_id', academy.id).eq('role', 'owner').limit(1).maybeSingle(), 'owner');
  const { data: ownerProfile } = owner
    ? await db.from('profiles').select('display_name').eq('id', owner.user_id).maybeSingle()
    : { data: null };
  const coachName = ownerProfile?.display_name?.trim() || 'Coach';

  // Existing sample accounts, by email.
  const existing = new Map<string, string>();
  for (let page = 1; page < 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    for (const u of data?.users ?? []) if (u.email?.startsWith('demo-')) existing.set(u.email, u.id);
    if ((data?.users.length ?? 0) < 200) break;
  }

  const ids: Record<string, string> = {};
  for (const [i, p] of PLAYERS.entries()) {
    const email = `demo-${p.first.toLowerCase()}-${p.last.toLowerCase()}@train.futbol`;
    let id = existing.get(email);
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
      if (error || !data.user) throw new Error(`create ${email}: ${error?.message}`);
      id = data.user.id;
    }
    ids[p.first] = id;

    await must(db.from('profiles').upsert({
      id, display_name: `${p.first} ${p.last}`, age_band: p.age, positions: p.positions, dominant_foot: p.foot,
    }), 'profile');
    await must(db.from('academy_members').upsert({
      academy_id: academy.id, user_id: id, role: 'player', joined_at: new Date(toUtc(addDays(today, -30))).toISOString(),
    }), 'member');

    // Start clean: this account's plans and sessions are all ours.
    await must(db.from('workouts').delete().eq('user_id', id), 'clear workouts');
    await must(db.from('plans').delete().eq('user_id', id), 'clear plans');

    const pick = (n: number) => sessions[(i * 7 + n) % sessions.length];
    if (p.days.length) {
      const plan = await must(db.from('plans').insert({ user_id: id, name: `${p.first}'s week`, active: true }).select('id').single(), 'plan');
      await must(db.from('plan_days').insert(p.days.map((d, n) => ({
        plan_id: plan!.id, weekday: d, slot: 0, kind: 'technical', session_id: pick(n).id,
      }))), 'plan days');
    }

    // Which days they trained.
    const trained: string[] = [];
    if (!p.never) {
      if (p.casual) trained.push(...p.casual.map((n) => addDays(today, -n)));
      else {
        const thisWeekPlanned = Array.from({ length: weekday(today) + 1 }, (_, n) => addDays(monday, n))
          .filter((d) => p.days.includes(weekday(d)));
        // slice(-0) would be the whole week, so no misses is spelled out.
        const skip = new Set(p.missThisWeek ? thisWeekPlanned.slice(-Math.min(p.missThisWeek, thisWeekPlanned.length)) : []);
        for (let back = 27; back >= 0; back--) {
          const d = addDays(today, -back);
          if (p.quiet && back < p.quiet) continue;
          const planned = p.days.includes(weekday(d));
          const roll = chance(`${p.first}${d}`);
          if (d >= monday) {
            if (planned && !skip.has(d)) trained.push(d);
          } else if (planned ? roll < p.rate : roll < (p.extra ?? 0)) trained.push(d);
        }
      }
    }

    if (trained.length) {
      await must(db.from('workouts').insert(trained.map((d, n) => {
        // A planned day's own session, so the player's Today card counts it;
        // an extra day gets something else from the library.
        const slot = p.days.indexOf(weekday(d));
        const s = slot >= 0 ? pick(slot) : pick(p.days.length + n);
        const minutes = Math.round(Number(s.total_minutes) || 20);
        const at = evening(d, i * 37 + n * 11);
        return {
          user_id: id, title: s.name, source: 'library', source_ref: s.id,
          planned_minutes: minutes, actual_minutes: minutes, planned_touches: minutes * 40, actual_touches: minutes * 40,
          status: 'completed', completed_at: at, created_at: at,
        };
      })), 'workouts');
    }
    console.log(`  ${p.first.padEnd(7)} ${trained.length} sessions`);
  }

  await seedGroups(academy.id, owner?.user_id ?? null, ids);

  // Soccer days (0008) for most of them, so the week shows sessions placed
  // around club and game days. Jayden and Mateo are left to be asked.
  const SOCCER: Record<string, { club: number[]; game: number }> = {
    Liam: { club: [0, 3], game: 5 }, Olivia: { club: [1, 3], game: 5 }, Ava: { club: [0, 2], game: 6 },
    Noah: { club: [1, 3], game: 5 }, Sofia: { club: [1, 3], game: 6 }, Emma: { club: [0, 2], game: 5 },
  };
  const sched = await db.from('player_schedules').upsert(Object.entries(SOCCER).map(([first, x]) => ({
    user_id: ids[first], club_days: x.club, game_day: x.game, updated_at: new Date().toISOString(),
  })));
  if (sched.error) console.log('  (soccer days skipped: run migration 0008)');
  else {
    await db.from('player_schedules').delete().in('user_id', ['Jayden', 'Mateo'].map((f) => ids[f]));
    await db.from('session_moves').delete().in('user_id', sample0(ids));
  }

  // Notes: replace the sample ones, keep anything a real trainer wrote.
  const sample = Object.values(ids);
  const { data: old } = await db.from('note_recipients').select('note_id').in('user_id', sample);
  const oldIds = [...new Set((old ?? []).map((r) => r.note_id))];
  if (oldIds.length) {
    const { data: theirs } = await db.from('note_recipients').select('note_id').in('note_id', oldIds).not('user_id', 'in', `(${sample.join(',')})`);
    const shared = new Set((theirs ?? []).map((r) => r.note_id));
    const ours = oldIds.filter((n) => !shared.has(n));
    if (ours.length) await must(db.from('notes').delete().in('id', ours), 'clear notes');
  }
  for (const n of NOTES) {
    const to = n.all ? PLAYERS.map((p) => p.first) : n.to!;
    const at = new Date(Date.now() - n.daysAgo * dayMs).toISOString();
    const note = await must(db.from('notes').insert({
      academy_id: academy.id, author_id: owner?.user_id ?? null, author_name: coachName, body: n.body, created_at: at,
    }).select('id').single(), 'note');
    await must(db.from('note_recipients').insert(to.map((first) => ({
      note_id: note!.id, user_id: ids[first],
      seen_at: chance(`${first}${n.body}`) < n.seenBy ? new Date(Date.parse(at) + 3 * 3600000).toISOString() : null,
    }))), 'recipients');
  }

  console.log(`Seeded ${PLAYERS.length} players into ${academy.name} (${slug}).`);
}

const sample0 = (ids: Record<string, string>) => Object.values(ids);

/** Drills, a program and two groups. Replaces its own by name each run. */
async function seedGroups(academyId: string, ownerId: string | null, ids: Record<string, string>) {
  const probe = await db.from('academy_programs').select('id').limit(1);
  if (probe.error) { console.log('  (groups skipped: run migration 0007 first)'); return; }

  await must(db.from('groups').delete().eq('academy_id', academyId).in('name', GROUPS.map((g) => g.name)), 'clear groups');
  await must(db.from('academy_programs').delete().eq('academy_id', academyId).eq('name', PROGRAM.name), 'clear program');
  await must(db.from('drills').delete().eq('academy_id', academyId).in('name', DRILLS.map((d) => d.name)), 'clear drills');

  const drills = await must(db.from('drills').insert(DRILLS.map(({ key: _k, ...d }) => ({ ...d, academy_id: academyId, created_by: ownerId })))
    .select('id, name'), 'drills');
  const drillId = (key: string) => drills!.find((d) => d.name === DRILLS.find((x) => x.key === key)!.name)!.id;

  const program = await must(db.from('academy_programs').insert({
    academy_id: academyId, name: PROGRAM.name, weeks: PROGRAM.weeks, description: PROGRAM.description,
  }).select('id').single(), 'program');
  const sessions = await must(db.from('academy_sessions').insert(PROGRAM.sessions.map((x, i) => ({
    academy_id: academyId, program_id: program!.id, week: x.week, position: i % 2, name: x.name, drill_ids: x.drills.map(drillId),
  }))).select('id, week, position'), 'sessions');

  for (const g of GROUPS) {
    const startsOn = addDays(monday, -7 * (g.weeksIn - 1));
    const group = await must(db.from('groups').insert({
      academy_id: academyId, name: g.name, meets_weekday: g.weekday, meets_time: g.time, program_id: program!.id, starts_on: startsOn,
    }).select('id').single(), 'group');
    await must(db.from('group_members').insert(g.members.map((m) => ({ group_id: group!.id, academy_id: academyId, user_id: ids[m] }))), 'members');
  }

  // This week's homework (weeks 1-2 use week 1's sessions, 3+ use week 3's)
  // for the longer-running group, ticked for a few players.
  const week = GROUPS[0].weeksIn >= 3 ? 3 : 1;
  const current = sessions!.filter((x) => x.week === week).sort((a, b) => a.position - b.position);
  const rows = Object.entries(GROUP_DONE).flatMap(([first, done], n) => done.map((idx, k) => {
    const s = current[idx];
    const at = evening(addDays(monday, Math.min(weekday(today), k)), n * 13 + k);
    return {
      user_id: ids[first], title: PROGRAM.sessions[PROGRAM.sessions.findIndex((x) => x.week === week) + idx].name,
      source: 'academy', source_ref: s.id, planned_minutes: 15, actual_minutes: 15, planned_touches: 0, actual_touches: 0,
      status: 'completed', completed_at: at, created_at: at,
    };
  }));
  if (rows.length) await must(db.from('workouts').insert(rows), 'group workouts');

  // One "just for you" drill, so the dashboard shows what that looks like.
  await must(db.from('addons').insert({
    academy_id: academyId, user_id: ids.Noah, drill_id: drillId('turns'), week_of: monday, created_by: ownerId,
    note: 'Noah, check your shoulder before every turn. Ten each way and you\'re done.',
  }), 'addon');
  console.log(`  groups  ${GROUPS.map((g) => g.name).join(', ')}`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
