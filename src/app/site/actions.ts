'use server';
import { serverClient } from '@/lib/supabase/server';

export type Found = { slug: string; name: string; city: string | null };

/** "Find your trainer": listed academies whose name, address or town matches. */
export async function findAcademies(q: string): Promise<Found[]> {
  const query = q.trim().slice(0, 60);
  if (query.length < 2) return [];
  const db = await serverClient();
  const { data, error } = await db.rpc('find_academies', { p_q: query });
  if (error) return [];
  return (data ?? []) as Found[];
}

const pick = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max);

/** "Get started": stored for an admin to follow up. The database checks the shape. */
export async function requestAcademy(_: unknown, form: FormData): Promise<{ ok: boolean; error?: string }> {
  const name = pick(form.get('name'), 80);
  const email = pick(form.get('email'), 200);
  const academy = pick(form.get('academy'), 40);
  const slug = pick(form.get('slug'), 30).toLowerCase();
  if (!name || !email || !academy) return { ok: false, error: 'Fill in your name, email and academy name.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'That email doesn’t look right.' };
  if (slug && !/^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$/.test(slug)) {
    return { ok: false, error: 'The address can use letters, numbers and dashes, 3 to 30 long.' };
  }
  const db = await serverClient();
  const { error } = await db.rpc('request_academy', {
    p_name: name, p_email: email, p_academy_name: academy, p_slug: slug,
    p_city: pick(form.get('city'), 60), p_players: pick(form.get('players'), 20),
    p_trainers: pick(form.get('trainers'), 20), p_content: pick(form.get('content'), 40),
    p_message: pick(form.get('message'), 2000),
  });
  if (error) return { ok: false, error: 'Couldn’t send that. Try again in a minute.' };
  return { ok: true };
}
