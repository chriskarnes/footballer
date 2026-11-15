'use client';
import { useState, useTransition } from 'react';
import { replaceSelfServeInvite } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';

/**
 * A self-serve space's invite link (0031), the only way in while it's
 * closed. Copy it to send; replace it if it got around.
 */
export function SelfServeInvite({ id, site, code: initial }: { id: string; site: string; code: string | null | undefined }) {
  if (initial === undefined) {
    return (
      <div className="card mt-4 p-5">
        <div className="h-card">Invite link</div>
        <p className="mt-1 text-body text-on-surface-variant">Shows here once migration 0031 has run.</p>
      </div>
    );
  }
  return <Invite id={id} site={site} initial={initial} />;
}

function Invite({ id, site, initial }: { id: string; site: string; initial: string | null }) {
  const [code, setCode] = useState(initial);
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const link = code ? `${site}/join/${code}` : null;
  return (
    <div className="card mt-4 p-5">
      <div className="h-card">Invite link</div>
      {link ? (
        <p className="mt-2 break-all font-mono text-body text-on-surface">{link}</p>
      ) : (
        <p className="mt-1 text-body text-on-surface-variant">No link yet. Make one to let players in.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2.5">
        {link && (
          <button type="button" className="btn-primary btn-sm pressable"
                  onClick={() => navigator.clipboard.writeText(link).then(() => setMsg('Copied.'), () => setMsg('Couldn’t copy. Select the link instead.'))}>
            Copy link
          </button>
        )}
        <button type="button" disabled={busy} className="btn-ghost btn-sm pressable"
                onClick={() => {
                  if (code && !confirm('Replace the link? The old one stops working, for anyone who hasn’t joined yet.')) return;
                  start(async () => {
                    setMsg('');
                    const r = await replaceSelfServeInvite(id).catch(offline);
                    if (r.ok) { setCode(r.code); setMsg(code ? 'Replaced. The old link no longer works.' : 'Made.'); }
                    else setMsg(r.error);
                  });
                }}>
          {busy ? 'Working…' : code ? 'Replace link' : 'Make a link'}
        </button>
      </div>
      <p role="status" className="mt-3 text-body-sm font-semibold text-on-surface">{msg}</p>
    </div>
  );
}
