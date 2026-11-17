'use client';
import { offline } from '@/lib/plain-error';
import { useEffect, useState } from 'react';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { rotateInvite } from '@/app/coach/actions';
import { useToast } from './Toast';

/**
 * An invite link with the ways a trainer actually sends one: the phone's
 * share sheet (straight into a text to a parent), or copy. Replacing it is for
 * a link that's got around too far — the old one stops working.
 */
export function InviteLink({ path, role, canRotate = true }: {
  path: string; role: 'player' | 'trainer'; canRotate?: boolean;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState(path);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // The link as a code to scan: for a parent standing beside you at the field.
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  useEffect(() => {
    if (!showQr || !origin) return;
    let live = true;
    import('qrcode').then((m) => m.toDataURL(`${origin}${current}`, { margin: 2, width: 480, errorCorrectionLevel: 'M' }))
      .then((src) => { if (live) setQr(src); }, () => { if (live) { setShowQr(false); setErr('Couldn’t draw the code. Use the link instead.'); } });
    return () => { live = false; };
  }, [showQr, origin, current]);
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
        <div className="card-flat min-w-0 flex-1 select-all truncate rounded-full px-4 py-2.5 text-body font-semibold text-on-surface">{shown}</div>
        {canShare && (
          <button type="button" className="btn-primary btn-sm pressable shrink-0"
                  onClick={() => navigator.share({ url }).catch(() => {})}>Share</button>
        )}
        <button type="button" className="btn-ghost btn-sm pressable shrink-0" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
        {role === 'player' && (
          <button type="button" aria-expanded={showQr} className="text-body-sm font-semibold text-on-surface-variant underline underline-offset-4"
                  onClick={() => setShowQr((v) => !v)}>
            {showQr ? 'Hide the code' : 'Show a code to scan'}
          </button>
        )}
        {canRotate && (
          <button type="button" className="text-body-sm font-semibold text-on-surface-variant underline underline-offset-4"
                  onClick={() => setConfirm(true)}>
            Replace this link
          </button>
        )}
      </div>
      {showQr && (
        <div className="hint-in mt-4 flex flex-col items-center rounded-large bg-white p-5 text-center">
          {qr
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={qr} alt="A code that opens your invite link" className="h-56 w-56" />
            : <div className="h-56 w-56 animate-pulse rounded-medium bg-neutral-200" />}
          <p className="mt-3 text-body font-semibold text-black">Point a phone&rsquo;s camera at this to join.</p>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-body-sm font-semibold text-on-surface">{err}</p>}
      <ConfirmSheet open={confirm} busy={busy} title="Make a new link?" confirmLabel="New link"
        body={`The old ${role} link stops working. Anyone who already joined stays.`}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          const r = await rotateInvite(role).catch(offline);
          setBusy(false); setConfirm(false);
          if (r.ok) { setCurrent(`/join/${r.code}`); toast('New link made. The old one no longer works.'); } else setErr(r.error);
        }} />
    </div>
  );
}
