'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/client';
import { notePageCacheUser } from '@/lib/page-cache';

/**
 * The way out. The app has had a sign-in since the beginning and no sign-out,
 * which on a shared family phone means the first person to use it owns the
 * account until someone clears the site data.
 *
 * router.refresh() rather than a reload: the session cookie is cleared by the
 * client, and the server components have to be re-rendered for Me to notice.
 */
export function SignOut({
  className = 'pressable text-body-sm font-semibold text-on-surface-variant underline underline-offset-4', to = '/me',
}: { className?: string; /** Where to go after: Me, or back to the page that asked. */ to?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function out() {
    setBusy(true);
    try {
      // This phone only: "Not you?" on the family iPad mustn't sign the parent's own phone out too.
      await browserClient().auth.signOut({ scope: 'local' });
      await notePageCacheUser(null);
      router.replace(to);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={out} disabled={busy}
            className={className}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
