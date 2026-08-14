'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/client';

/**
 * The way out. The app has had a sign-in since the beginning and no sign-out,
 * which on a shared family phone means the first person to use it owns the
 * account until someone clears the site data.
 *
 * router.refresh() rather than a reload: the session cookie is cleared by the
 * client, and the server components have to be re-rendered for Me to notice.
 */
export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function out() {
    setBusy(true);
    try {
      await browserClient().auth.signOut();
      router.replace('/me');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={out} disabled={busy}
            className="pressable text-[13px] font-semibold text-on-surface-variant underline underline-offset-4">
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
