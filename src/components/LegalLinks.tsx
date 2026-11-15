'use client';
import { useEffect, useState } from 'react';
import { rootOrigin } from '@/lib/tenant';

/**
 * "Privacy · Terms", under a sign-in form. The pages live on the main site;
 * on an academy's address the links are pointed there once the page is in
 * the browser (the server doesn't know the address here).
 */
export function LegalLinks({ lead = 'By signing in you agree to the' }: { lead?: string }) {
  const [root, setRoot] = useState('');
  useEffect(() => { try { setRoot(rootOrigin(window.location.origin)); } catch { /* stays relative */ } }, []);
  const link = 'underline underline-offset-4';
  return (
    <p className="mt-3 text-caption leading-snug text-on-surface-variant">
      {lead} <a href={`${root}/terms`} className={link}>terms</a> and <a href={`${root}/privacy`} className={link}>privacy policy</a>.
      {' '}For a player under 13, a parent signs in with their own email.
    </p>
  );
}
