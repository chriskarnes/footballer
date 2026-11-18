'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { askToInstall, watchInstallable } from '@/lib/install';
import { SignOut } from './SignOut';

/**
 * The account's own business, at the bottom where it belongs. Sign out used to
 * be the first thing on Me, top right, in the spot every other tab gives its
 * headline.
 *
 * Add to home screen is here for anyone who dismissed the sheet or never got to
 * the third visit; it only appears where installing is possible and hasn't
 * happened.
 *
 * Leaving the academy and deleting the account aren't here: they're at the
 * bottom of My profile, a tap further from Sign out, which is the one a
 * player means nearly every time.
 */
export function AccountSection({ email, canBrand, role, admin, legal }: {
  email?: string; canBrand?: boolean; role?: string | null;
  /** Where the privacy policy and terms are (the main site). */
  legal?: { privacy: string; terms: string };
  /** A platform admin: the way into /admin. */
  admin?: boolean;
}) {
  const [installable, setInstallable] = useState(false);
  useEffect(() => watchInstallable(setInstallable), []);

  return (
    <section className="mt-10">
      <h2 className="h-sec mb-3">Account</h2>
      <div className="card divide-y divide-outline-variant">
        <Link href="/me/profile" className="pressable block">
          <Row label="My profile"><Chevron /></Row>
        </Link>
        {installable && (
          <button type="button" onClick={askToInstall} className="pressable block w-full text-left">
            <Row label="Add to home screen">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-on-surface-variant"
                   fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Row>
          </button>
        )}
        {role === 'player' && (
          <Link href="/me/notes" className="pressable block">
            <Row label="Notes from your trainer">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-on-surface-variant"
                   fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Row>
          </Link>
        )}
        {(role === 'owner' || role === 'trainer') && (
          <Link href="/coach" className="pressable block">
            <Row label="My players">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-on-surface-variant"
                   fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Row>
          </Link>
        )}
        {canBrand && (
          <Link href="/coach/brand" className="pressable block">
            <Row label="Colors and logo">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-on-surface-variant"
                   fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Row>
          </Link>
        )}
        {admin && (
          <Link href="/admin" className="pressable block">
            <Row label="Platform admin">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-on-surface-variant"
                   fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Row>
          </Link>
        )}
        {/* The whole row is the button, like the row above it. */}
        <SignOut className="pressable flex min-h-14 w-full items-center px-4 text-left
                            text-body-lg font-bold text-on-surface" />
      </div>
      {email && <p className="mt-3 pl-1 text-caption text-on-surface-variant">{email}</p>}
      {legal && (
        <p className="mt-3 pl-1 text-caption text-on-surface-variant">
          <a href={legal.privacy} className="underline underline-offset-4">Privacy</a>{' · '}
          <a href={legal.terms} className="underline underline-offset-4">Terms</a>
        </p>
      )}
    </section>
  );
}

const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-on-surface-variant"
       fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-4">
      <span className="shrink-0 text-body-lg font-bold text-on-surface">{label}</span>
      <span className="flex min-w-0 items-center text-body-sm text-on-surface-variant">{children}</span>
    </div>
  );
}
