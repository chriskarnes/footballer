'use client';
import { useEffect, useState } from 'react';
import { browserClient } from './supabase/client';

/**
 * The signed-in account's role in this academy, read in the browser so the
 * root layout never waits on an auth round trip. The last answer is kept for
 * the tab's lifetime, so the Coach tab doesn't blink in on every page.
 */
export function useAcademyRole(academyId: string | null, recheck = false) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!academyId || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const key = `role:${academyId}`;
    try { const kept = sessionStorage.getItem(key); if (kept !== null) setRole(kept || null); } catch {}

    let live = true;
    const db = browserClient();
    db.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      const { data: m } = uid
        ? await db.from('academy_members').select('role').eq('academy_id', academyId).eq('user_id', uid).maybeSingle()
        : { data: null };
      if (!live) return;
      setRole(m?.role ?? null);
      try { sessionStorage.setItem(key, m?.role ?? ''); } catch {}
    }).catch(() => {});
    return () => { live = false; };
  // `recheck` flips on the trainer pages, where someone who has just joined
  // as a trainer lands, so their tab appears without a reload.
  }, [academyId, recheck]);

  return role;
}
