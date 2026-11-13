'use client';
import { useEffect, useState } from 'react';
import { approveRequest } from '@/app/admin/requests/actions';
import { academyOrigin } from '@/lib/tenant';

/**
 * Approving a "Get started" request, on its card in /admin/requests: the
 * address and name (the request's, editable), then Approve. That makes the
 * academy and gives the trainer's claim link, to copy or send from your own
 * email. There's no email service yet, so the app doesn't send it.
 *
 * Approved already, the card shows the link, and whether it's been claimed.
 */
export function ApproveRequest({ id, slug, academyName, email, trainer, approved }: {
  id: string; slug: string | null; academyName: string; email: string; trainer: string;
  approved: { slug: string; code: string; claimed: boolean } | null;
}) {
  const [address, setAddress] = useState(slug ?? '');
  const [name, setName] = useState(academyName);
  const [done, setDone] = useState(approved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [here, setHere] = useState('');
  useEffect(() => { setHere(window.location.origin); }, []);

  if (done) {
    const url = here ? `${academyOrigin(done.slug, here)}/claim/${done.code}` : '';
    const first = trainer.split(' ')[0];
    const subject = `${name} is ready on train.futbol`;
    const body = `Hi ${first},\n\nYour academy, ${name}, is ready at ${done.slug}.train.futbol.\n\n`
      + `Open this link and sign in with this email address to make it yours. A short checklist then walks you `
      + `through your first drills, a session and a program, and your players' invite link.\n\n${url}\n`;
    return (
      <div className="mt-4 border-t border-outline-variant pt-4">
        <p className="text-[13.5px] font-bold text-on-surface">
          {done.claimed ? `Claimed. ${first} is the owner.` : `Approved. Send ${first} this link to claim it:`}
        </p>
        {!done.claimed && (
          <>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="card-flat min-w-0 flex-1 select-all truncate rounded-full px-4 py-2.5 text-[13px] font-semibold text-on-surface">
                {url.replace(/^https?:\/\//, '')}
              </div>
              <button type="button" className="btn-ghost btn-sm pressable shrink-0"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
                        catch { setErr('Couldn’t copy. Press and hold the link instead.'); }
                      }}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <a href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
               className="btn-primary btn-sm pressable mt-2.5 inline-flex">
              Email it to {first}
            </a>
            <p className="mt-2 text-[12.5px] text-on-surface-variant">
              Only {email} can claim it, signed in with that address.
            </p>
          </>
        )}
        {err && <p role="status" className="mt-2 text-[12.5px] font-semibold text-on-surface">{err}</p>}
      </div>
    );
  }

  return (
    <form className="mt-4 border-t border-outline-variant pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true); setErr('');
            const r = await approveRequest(id, address, name);
            setBusy(false);
            if (r.ok) setDone({ slug: r.slug, code: r.code, claimed: false }); else setErr(r.error);
          }}>
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
      <button type="submit" disabled={busy} className="btn-primary btn-sm pressable mt-3">
        {busy ? 'Approving…' : 'Approve'}
      </button>
      {err && <p role="status" className="mt-2 text-[13px] font-semibold text-on-surface">{err}</p>}
    </form>
  );
}
