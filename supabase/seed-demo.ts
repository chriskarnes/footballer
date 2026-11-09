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

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
