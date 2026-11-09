'use client';
import { useEffect, useState } from 'react';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { rotateInvite } from '@/app/coach/actions';

/**
 * An invite link with the ways a trainer actually sends one: the phone's
 * share sheet (straight into a text to a parent), or copy. "New link" is for
 * a link that's got around too far — the old one stops working.
 */
export function InviteLink({ path, role, canRotate = true }: {
  path: string; role: 'player' | 'trainer'; academyId?: string; canRotate?: boolean;
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

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setErr('Couldn’t copy. Press and hold the link instead.'); }
  }

  return (
    <div className="mt-4">
      <div className="card-flat select-all break-all px-4 py-3 font-mono text-[12.5px] text-on-surface">{url || current}</div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {canShare
          ? <button type="button" className="btn-primary btn-sm pressable"
                    onClick={() => navigator.share({ url }).catch(() => {})}>Share</button>
          : null}
        <button type="button" className={`btn-ghost btn-sm pressable ${canShare ? '' : 'col-span-2'}`} onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      {canRotate && (
        <button type="button" className="mt-3 text-[12.5px] font-semibold text-on-surface-variant underline underline-offset-4"
                onClick={() => setConfirm(true)}>
          New link
        </button>
      )}
      {err && <p role="status" className="mt-2 text-[12.5px] font-semibold text-on-surface">{err}</p>}
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
