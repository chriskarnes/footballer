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
  ai_30d: { calls: number; failed: number; tokens: number };
  weeks: { week: string; signups: number; sessions: number; active: number }[];
  recent: { id: string; user_id: string; title: string; source: string; feel: string | null; at: string;
            minutes: number | null; email: string; name: string | null; academies: string | null }[];
  signups: { id: string; email: string; name: string | null; created_at: string; last_sign_in_at: string | null;
             academies: { slug: string; name: string; role: string }[] | null }[];
};

export type AcademyRow = {
  id: string; slug: string; name: string; city: string | null; created_at: string;
  library_access: boolean; listed: boolean; set_up: boolean;
  owner: { id: string; email: string; name: string | null } | null;
  trainers: number; players: number; active_7d: number; sessions_7d: number; sessions_30d: number;
  last_done: string | null; programs: number; groups: number; drills: number; notes_30d: number;
  waiting: number; ai_30d: number;
};

export type AcademyDetail = {
  id: string; slug: string; name: string; city: string | null; time_zone: string; created_at: string;
  library_access: boolean; listed: boolean; set_up: boolean; billing_mode: string; price_cents: number | null;
  members: { id: string; role: 'owner' | 'trainer' | 'player'; joined_at: string; email: string; name: string | null;
             last_sign_in_at: string | null; sessions_7d: number; sessions_30d: number; last_done: string | null;
             groups: string | null }[];
  programs: { id: string; name: string; weeks: number; created_at: string; sessions: number }[];
  groups: { id: string; name: string; program: string | null; starts_on: string | null; members: number }[];
  waiting: { id: string; name: string; email: string; created_at: string }[];
  drills: number; notes_30d: number;
  ai_30d: { calls: number; failed: number; tokens: number };
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
  asking: { id: string; slug: string; name: string; created_at: string }[];
  plan: { name: string | null; created_at: string; days: number } | null;
  sessions_all: number; minutes_all: number;
  notes: { received: number; unread: number }; notes_sent: number;
  workouts: { id: string; title: string; source: string; status: string; feel: string | null; at: string;
              minutes: number | null; touches: number | null }[];
};

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
export const loadUsers = () => call<UserRow[]>('admin_users');
export const loadAcademy = (id: string) =>
  UUID.test(id) ? call<AcademyDetail | null>('admin_academy', { p_id: id }) : Promise.resolve({ data: null, error: null });
export const loadUser = (id: string) =>
  UUID.test(id) ? call<UserDetail | null>('admin_user', { p_id: id }) : Promise.resolve({ data: null, error: null });

/** "Library", "Speed": where a session came from, in the panel's words. */
export function sourceLabel(s: string) {
  return ({ academy: 'Trainer session', addon: 'Extra', plan: 'Plan', library: 'Library', coach: 'Free session',
            speed: 'Speed', custom: 'Custom' } as Record<string, string>)[s] ?? s;
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
