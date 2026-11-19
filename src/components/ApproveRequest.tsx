'use client';
import { mailtoAddr } from '@/lib/mailto';
import { useEffect, useState } from 'react';
import { approveRequest } from '@/app/admin/requests/actions';
import { academyOrigin } from '@/lib/tenant';
import { offline } from '@/lib/plain-error';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useCopied } from '@/lib/use-copied';

/**
 * Approving a "Get started" request, on its card in /admin/requests: the
 * address and name (the request's, editable), then Approve. That makes the
 * academy and gives the trainer's claim link, to copy or send from your own
 * email. There's no email service yet, so the app doesn't send it.
 *
 * Approved already, the card shows the link, and whether it's been claimed.
 */
export function ApproveRequest({ id, slug, academyName, email, trainer, approved, extra }: {
  id: string; slug: string | null; academyName: string; email: string; trainer: string;
  approved: { slug: string; code: string; claimed: boolean } | null;
  /** What sits beside Approve: the request's menu. */
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(slug ?? '');
  const [name, setName] = useState(academyName);
  const [done, setDone] = useState(approved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, flashCopied] = useCopied();
  const [here, setHere] = useState('');
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setHere(window.location.origin); }, []);

  if (done) {
    const url = here ? `${academyOrigin(done.slug, here)}/claim/${done.code}` : '';
    const first = trainer.split(' ')[0];
    const subject = `${name} is ready on train.futbol`;
    const body = `Hi ${first},\n\nYour academy, ${name}, is ready at ${done.slug}.train.futbol.\n\n`
      + `Open this link and sign in with this email address to make it yours. A short checklist then walks you `
      + `through your first drills, a session and a program, and your players' invite link.\n\n${url}\n`;
    return (
      <div className="mt-5">
        <p className="text-body font-bold text-on-surface">
          {done.claimed ? `Claimed. ${first} is the owner.` : `Send ${first} this link to claim it:`}
        </p>
        {!done.claimed && (
          <>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="card-flat min-w-0 flex-1 select-all truncate rounded-full px-4 py-2.5 text-body-sm font-semibold text-on-surface">
                {url.replace(/^https?:\/\//, '')}
              </div>
              <button type="button" className="btn-ghost btn-sm pressable shrink-0"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(url); flashCopied(); }
                        catch { setErr('Couldn’t copy. Press and hold the link instead.'); }
                      }}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <span role="status" className="sr-only">{copied ? 'Copied' : ''}</span>
            </div>
            <a href={`mailto:${mailtoAddr(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
               className="btn-primary btn-sm pressable mt-2.5 inline-flex">
              Email it to {first}
            </a>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Only {email} can claim it, signed in with that address.
            </p>
          </>
        )}
        {err && <p role="alert" className="mt-2 text-body-sm font-semibold text-on-surface">{err}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-5 flex items-center gap-2">
        <button type="button" className="btn-primary btn-sm pressable" onClick={() => setOpen(true)}>Approve</button>
        {extra}
      </div>
    );
  }

  return (
    <form className="mt-5 rounded-2xl bg-surface-container-low p-5"
          onSubmit={(e) => { e.preventDefault(); setErr(''); setConfirming(true); }}>
      <ConfirmSheet open={confirming} busy={busy} title={`Make ${address.trim() || 'this'}.train.futbol?`} confirmLabel="Approve"
        body={`This creates ${name.trim() || 'the academy'} at ${address.trim()}.train.futbol, unlisted, for ${email} to claim. The address can't be taken back.`}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setBusy(true);
          const r = await approveRequest(id, address, name).catch(offline);
          setBusy(false); setConfirming(false);
          if (r.ok) setDone({ slug: r.slug, code: r.code, claimed: false }); else setErr(r.error);
        }} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="text-field">
          <span>Address (.train.futbol)</span>
          <input value={address} onChange={(e) => setAddress(e.target.value.toLowerCase())} required
                 placeholder="mikes-academy" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </label>
        <label className="text-field">
          <span>Academy name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary btn-sm pressable">Approve…</button>
        <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => { setErr(''); setOpen(false); }}>Cancel</button>
      </div>
      {err && <p role="alert" className="mt-2 text-body-sm font-semibold text-on-surface">{err}</p>}
    </form>
  );
}
