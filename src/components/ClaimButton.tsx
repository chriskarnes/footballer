'use client';
import { useState } from 'react';
import { claimAcademy } from '@/app/claim/actions';
import { SignOut } from './SignOut';

/**
 * The one tap that makes a signed-in trainer the owner. Signed in with a
 * different email than they asked with, it says which to use, with the way
 * to switch.
 */
export function ClaimButton({ code, name, email, hint }: { code: string; name: string; email: string; hint: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div>
      <button type="button" disabled={busy} className="btn-primary btn-big pressable w-full"
              onClick={async () => {
                setBusy(true); setErr('');
                const r = await claimAcademy(code);
                setBusy(false);
                if (r && !r.ok) setErr(r.error);
              }}>
        {busy ? 'One moment…' : `Make ${name} mine`}
      </button>
      <p className="mt-3 text-[13.5px] text-on-surface-variant">Signed in as {email}.</p>
      {err === 'wrong-email' ? (
        <div role="status" className="mt-3 text-[14px] leading-snug text-on-surface">
          <p><b>This link is for {hint}.</b> Sign out, then sign in with that address.</p>
          <SignOut to={`/claim/${code}`} className="btn-ghost pressable mt-3 min-h-12 w-full text-[15px] font-bold" />
        </div>
      ) : err && <p role="status" className="mt-3 text-[14px] font-semibold text-on-surface">{err}</p>}
    </div>
  );
}
