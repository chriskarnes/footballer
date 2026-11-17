import 'server-only';
import { getViewer } from './viewer';

/**
 * The platform admin panel's reads (0026). Each RPC refuses anyone not in
 * `admins` before it reads anything, so the page's own check is a courtesy
 * and a bug here fails closed at the database.
 */

export type Overview = {
  users: number; users_7d: number; users_30d: number; academies: number;
  trainers: number; players: number; no_academy: number;
  sessions_all: number; sessions_7d: number; sessions_30d: number; minutes_7d: number;
  active_7d: number; active_30d: number; requests_open: number; join_waiting: number;
  /** 0029 adds week and suggest; before it, calls is week builds only. */
  ai_30d: { calls: number; failed: number; tokens: number; week?: number; suggest?: number };
  weeks: { week: string; signups: number; sessions: number; active: number }[];
  recent: { id: string; user_id: string; title: string; source: string; feel: string | null; at: string;
            minutes: number | null; email: string; name: string | null;
            /** The academy the session was for (0027); before it, every academy the player is in. */
            academy?: string | null; academies?: string | null }[];
  signups: { id: string; email: string; name: string | null; created_at: string; last_sign_in_at: string | null;
             academies: { slug: string; name: string; role: string }[] | null }[];
};

export type AcademyRow = {
  id: string; slug: string; name: string; city: string | null; created_at: string;
  library_access: boolean; listed: boolean; set_up: boolean;
  /** Approved, but no owner has claimed it yet (0027). */
  unclaimed?: boolean;
  owner: { id: string; email: string; name: string | null } | null;
  trainers: number; players: number; active_7d: number; sessions_7d: number; sessions_30d: number;
  last_done: string | null; programs: number; groups: number; drills: number; notes_30d: number;
  waiting: number; ai_30d: number; ai_month?: number;
};

export type AcademyDetail = {
  id: string; slug: string; name: string; city: string | null; time_zone: string; created_at: string;
  library_access: boolean; listed: boolean; set_up: boolean; unclaimed?: boolean; billing_mode: string; price_cents: number | null;
  members: { id: string; role: 'owner' | 'trainer' | 'player'; joined_at: string; email: string; name: string | null;
             last_sign_in_at: string | null; sessions_7d: number; sessions_30d: number; last_done: string | null;
             groups: string | null }[];
  programs: { id: string; name: string; weeks: number; created_at: string; sessions: number }[];
  groups: { id: string; name: string; program: string | null; starts_on: string | null; members: number }[];
  waiting: { id: string; name: string; email: string; created_at: string; role?: 'player' | 'trainer' }[];
  drills: number; notes_30d: number;
  ai_30d: { calls: number; failed: number; tokens: number; week?: number; suggest?: number; month?: number };
  recent: { id: string; user_id: string; title: string; source: string; feel: string | null; at: string;
            minutes: number | null; who: string }[];
};

export type UserRow = {
  id: string; email: string; name: string | null; created_at: string; last_sign_in_at: string | null; admin: boolean;
  academies: { id: string; slug: string; name: string; role: string }[] | null;
  sessions_all: number; sessions_30d: number; last_done: string | null;
};

export type UserDetail = {
  id: string; email: string; created_at: string; last_sign_in_at: string | null; confirmed_at: string | null; admin: boolean;
  profile: { name: string | null; positions: string[] | null; age_band: string | null; level: string | null;
             dominant_foot: string | null; club: string | null; region: string | null; signed_up_by: string | null;
             speed_tests: number } | null;
  academies: { id: string; slug: string; name: string; role: string; joined_at: string }[];
  asking: { id: string; slug: string; name: string; created_at: string; role?: 'player' | 'trainer'; declined?: boolean }[];
  plan: { name: string | null; created_at: string; days: number } | null;
  sessions_all: number; minutes_all: number;
  /** 0027: the last session finished, and how many were started and left. */
  last_done?: string | null; unfinished?: number;
  notes: { received: number; unread: number }; notes_sent: number;
  workouts: { id: string; title: string; source: string; status: string; feel: string | null; at: string;
              minutes: number | null; touches: number | null; academy?: string | null }[];
};

export const USER_FILTERS = ['all', 'players', 'staff', 'none', 'quiet'] as const;
export type UserFilter = typeof USER_FILTERS[number];
export type UsersPage = { total: number; counts: Record<UserFilter, number>; rows: UserRow[] };

/** The signed-in admin, or what to show instead (sign in, or not allowed). */
export async function adminViewer() {
  const v = await getViewer();
  if (!v.user) return { gate: 'signin' as const };
  if (!v.isAdmin) return { gate: 'denied' as const };
  return { gate: null, viewer: v };
}

type Got<T> = { data: T | null; error: string | null };

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<Got<T>> {
  const v = await getViewer();
  const { data, error } = await v.db.rpc(fn, args);
  if (!error) return { data: data as T, error: null };
  console.error(`[admin] ${fn}`, error);
  // Before 0026 runs, the function isn't there.
  const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message);
  return { data: null, error: missing ? 'Run migration 0026 (admin panel) in Supabase first.' : 'Couldn’t load this. Try again.' };
}

const UUID = /^[0-9a-f-]{36}$/i;

export const loadOverview = () => call<Overview>('admin_overview');
export const loadAcademies = () => call<AcademyRow[]>('admin_academies');
export const USERS_PER_PAGE = 100;

/** One page of people, searched and filtered in the database (0027). */
export async function loadUsers(q: string, filter: UserFilter, page: number): Promise<Got<UsersPage>> {
  const v = await getViewer();
  const args = { p_query: q || null, p_filter: filter, p_limit: USERS_PER_PAGE, p_offset: page * USERS_PER_PAGE };
  const { data, error } = await v.db.rpc('admin_users', args);
  if (!error) return { data: data as UsersPage, error: null };
  if (error.code !== 'PGRST202') { console.error('[admin] admin_users', error); return { data: null, error: 'Couldn’t load this. Try again.' }; }
  // Before 0027: every account at once, filtered here.
  const old = await call<UserRow[]>('admin_users');
  if (!old.data) return { data: null, error: old.error };
  const keep: Record<UserFilter, (u: UserRow) => boolean> = {
    all: () => true,
    players: (u) => !!u.academies?.some((m) => m.role === 'player'),
    staff: (u) => !!u.academies?.some((m) => m.role !== 'player'),
    none: (u) => !u.academies?.length,
    quiet: (u) => !!u.academies?.some((m) => m.role === 'player') && u.sessions_30d === 0,
  };
  const found = old.data.filter((u) => !q || u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q)
    || !!u.academies?.some((m) => m.name.toLowerCase().includes(q) || m.slug.includes(q)));
  const picked = found.filter(keep[filter]);
  return { data: {
    total: picked.length,
    counts: Object.fromEntries(USER_FILTERS.map((f) => [f, found.filter(keep[f]).length])) as Record<UserFilter, number>,
    rows: picked.slice(page * USERS_PER_PAGE, (page + 1) * USERS_PER_PAGE),
  }, error: null };
}
export const loadAcademy = (id: string) =>
  UUID.test(id) ? call<AcademyDetail | null>('admin_academy', { p_id: id }) : Promise.resolve({ data: null, error: null });
export const loadUser = (id: string) =>
  UUID.test(id) ? call<UserDetail | null>('admin_user', { p_id: id }) : Promise.resolve({ data: null, error: null });

/**
 * The memberships a trainer has switched off (0040), as "academy:user" keys:
 * in one academy, for these accounts, or both. Empty before 0041 has run, so
 * nobody is called inactive on a guess.
 */
export async function loadInactive(by: { academy?: string; users?: string[] }): Promise<Set<string>> {
  if (by.users && !by.users.length) return new Set();
  const v = await getViewer();
  const { data, error } = await v.db.rpc('admin_inactive', { p_academy: by.academy ?? null, p_users: by.users ?? null });
  if (error) { if (error.code !== 'PGRST202') console.error('[admin] admin_inactive', error); return new Set(); }
  return new Set(((data ?? []) as { academy_id: string; user_id: string }[]).map((r) => `${r.academy_id}:${r.user_id}`));
}

/** "Library", "Speed": where a session came from, in the panel's words. */
export function sourceLabel(s: string) {
  return ({ academy: 'Trainer session', addon: 'Extra', plan: 'Plan', library: 'Library', coach: 'Free session',
            speed: 'Speed', custom: 'Custom' } as Record<string, string>)[s] ?? s;
}

/** Where a finished session was for: the academy, the player's own, or a trainer's session since deleted. */
export function forWhom(academy: string | null | undefined, source: string) {
  if (academy) return academy;
  return source === 'academy' || source === 'addon' ? 'A deleted session' : 'Own';
}

/** "12 AI calls (8 week builds, 4 suggestions)": every call counts toward the monthly limit. */
export function aiLine(a: { calls: number; failed: number; tokens: number; week?: number; suggest?: number }) {
  const kinds = a.week !== undefined ? ` (${n(a.week)} week ${a.week === 1 ? 'build' : 'builds'}, ${n(a.suggest)} ${a.suggest === 1 ? 'suggestion' : 'suggestions'})` : ' week builds';
  return `${n(a.calls)} AI ${a.calls === 1 ? 'call' : 'calls'}${kinds}${a.failed ? `, ${n(a.failed)} failed` : ''}, ${n(a.tokens)} tokens`;
}

/** 1,234 */
export const n = (x: number | null | undefined) => (x ?? 0).toLocaleString('en-US');

/** "Mar 4", or "Mar 4, 2025" when it isn't this year. */
export function day(at: string | null | undefined) {
  if (!at) return '—';
  const d = new Date(at);
  const year = d.getUTCFullYear() !== new Date().getUTCFullYear();
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(year && { year: 'numeric' }), timeZone: 'UTC' }).format(d);
}

/**
 * Which academies are self-serve (0030), and whether they're open: by id.
 * Empty before 0030 runs.
 */
export async function loadKinds(): Promise<Map<string, { selfServe: boolean; open: boolean }>> {
  const v = await getViewer();
  const { data, error } = await v.db.from('academies').select('id, kind, open');
  const out = new Map<string, { selfServe: boolean; open: boolean }>();
  if (error) return out;
  for (const r of (data ?? []) as { id: string; kind: string; open: boolean }[]) {
    out.set(r.id, { selfServe: r.kind === 'self_serve', open: r.open === true });
  }
  return out;
}
