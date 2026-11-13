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
 */
export function AccountSection({ email, version, canBrand, role }: {
  email?: string; version: string; canBrand?: boolean; role?: string | null;
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
            <Row label="Notes from my trainer">
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
            <Row label="Brand settings">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-on-surface-variant"
                   fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Row>
          </Link>
        )}
        {/* The whole row is the button, like the row above it. */}
        <SignOut className="pressable flex min-h-[56px] w-full items-center px-4 text-left
                            text-[15px] font-bold text-on-surface" />
      </div>
      <p className="mt-3 pl-1 text-[12px] text-on-surface-variant">{email && `${email} · `}v{version}</p>
    </section>
  );
}

const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-on-surface-variant"
       fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 px-4">
      <span className="shrink-0 text-[15px] font-bold text-on-surface">{label}</span>
      <span className="flex min-w-0 items-center text-[13px] text-on-surface-variant">{children}</span>
    </div>
  );
}
