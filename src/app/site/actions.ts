'use server';
import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
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

/** A few requests an hour from one address, per server instance. The database caps the total. */
const sent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now(), hour = 3600_000;
  const recent = (sent.get(ip) ?? []).filter((t) => now - t < hour);
  if (sent.size > 5000) sent.clear();
  if (recent.length >= 5) { sent.set(ip, recent); return true; }
  sent.set(ip, [...recent, now]);
  return false;
}

/** "Get started": stored for an admin to follow up. The database checks the shape. */
export async function requestAcademy(_: unknown, form: FormData): Promise<{ ok: boolean; error?: string }> {
  const name = pick(form.get('name'), 80);
  const email = pick(form.get('email'), 200);
  const academy = pick(form.get('academy'), 40);
  const slug = pick(form.get('slug'), 30).toLowerCase();
  if (!name || !email || !academy) return { ok: false, error: 'Fill in your name, your email and the name for your page.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'That email doesn’t look right.' };
  if (slug && !/^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$/.test(slug)) {
    return { ok: false, error: 'The address can use letters, numbers and dashes, 3 to 30 long.' };
  }
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  if (tooMany(ip)) return { ok: false, error: 'That’s a lot of requests from here. Try again in an hour.' };
  // Who sent it, so only they can fix a typo in it within the hour: keyed,
  // so it can't be worked out from the address alone.
  // Without a server secret there's no telling who sent it: no fixing then.
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const from = secret ? createHmac('sha256', secret).update(`${ip}|${h.get('user-agent') ?? ''}`).digest('hex').slice(0, 32) : null;
  // Only the server may store a request (0031), so the limits here hold.
  const db = secret
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, { auth: { persistSession: false } })
    : await serverClient();
  let { error } = await db.rpc('request_academy', {
    p_name: name, p_email: email, p_academy_name: academy, p_slug: slug,
    p_city: pick(form.get('city'), 60), p_players: pick(form.get('players'), 20),
    p_trainers: pick(form.get('trainers'), 20), p_content: pick(form.get('content'), 40),
    p_message: pick(form.get('message'), 2000), p_from: from,
  });
  // Before 0029 there's no p_from.
  if (error?.code === 'PGRST202') ({ error } = await db.rpc('request_academy', {
    p_name: name, p_email: email, p_academy_name: academy, p_slug: slug,
    p_city: pick(form.get('city'), 60), p_players: pick(form.get('players'), 20),
    p_trainers: pick(form.get('trainers'), 20), p_content: pick(form.get('content'), 40),
    p_message: pick(form.get('message'), 2000),
  }));
  if (error && /too many requests/.test(error.message)) return { ok: false, error: 'We’re getting a lot of requests right now. Try again in an hour.' };
  if (error) return { ok: false, error: 'Couldn’t send that. Try again in a minute.' };
  return { ok: true };
}
