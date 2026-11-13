'use client';
import { useEffect, useState } from 'react';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { rotateInvite } from '@/app/coach/actions';

/**
 * An invite link with the ways a trainer actually sends one: the phone's
 * share sheet (straight into a text to a parent), or copy. Replacing it is for
 * a link that's got around too far — the old one stops working.
 */
export function InviteLink({ path, role, canRotate = true }: {
  path: string; role: 'player' | 'trainer'; canRotate?: boolean;
}) {
  const [current, setCurrent] = useState(path);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setOrigin(window.location.origin); setCanShare(typeof navigator.share === 'function'); }, []);

  const url = `${origin}${current}`;
  // Shown without the scheme: shorter, and it's how people say an address.
  const shown = url.replace(/^https?:\/\//, '') || current;

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setErr('Couldn’t copy. Press and hold the link instead.'); }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <div className="card-flat min-w-0 flex-1 select-all truncate rounded-full px-4 py-2.5 text-[14px] font-semibold text-on-surface">{shown}</div>
        {canShare && (
          <button type="button" className="btn-primary btn-sm pressable shrink-0"
                  onClick={() => navigator.share({ url }).catch(() => {})}>Share</button>
        )}
        <button type="button" className="btn-ghost btn-sm pressable shrink-0" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {canRotate && (
        <button type="button" className="mt-2.5 text-[13px] font-semibold text-on-surface-variant underline underline-offset-4"
                onClick={() => setConfirm(true)}>
          Replace this link
        </button>
      )}
      {err && <p role="status" className="mt-2 text-[13px] font-semibold text-on-surface">{err}</p>}
      <ConfirmSheet open={confirm} busy={busy} title="Make a new link?" confirmLabel="New link"
        body={`The old ${role} link stops working. Anyone who already joined stays.`}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          const r = await rotateInvite(role);
          setBusy(false); setConfirm(false);
          if (r.ok) setCurrent(`/join/${r.code}`); else setErr(r.error);
        }} />
    </div>
  );
}
