'use client';
import { useState, useTransition } from 'react';
import { askToJoin } from '@/app/request/actions';
import { SignOut } from '@/components/SignOut';
import { offline } from '@/lib/plain-error';

/** Who you are, in words the trainer will recognise, and one button. */
export function AskToJoin({ academy, email, pending: wasPending }: { academy: string; email: string; pending: boolean }) {
  const [sent, setSent] = useState(wasPending);
  const [member, setMember] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();

  if (member) {
    return (
      <div className="card p-5" role="status">
        <div className="h-card">You&rsquo;re already in</div>
        <p className="mt-1 text-body leading-relaxed text-on-surface-variant">
          This account is already one of {academy}&rsquo;s players.
        </p>
        <a href="/" className="btn-primary pressable mt-4 w-full">Go train</a>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="card p-5" role="status">
        <div className="h-card">Asked</div>
        <p className="mt-1 text-body leading-relaxed text-on-surface-variant">
          {academy} will see your request next time they open their players. Once they let you in, your sessions are here.
        </p>
      </div>
    );
  }

  return (
    <form className="card space-y-4 p-5" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await askToJoin(name, message).catch(offline);
        if (!r.ok) setErr(r.error); else if ('member' in r && r.member) setMember(true); else setSent(true);
      });
    }}>
      <p className="text-body text-on-surface-variant">
        Signed in as {email}. Not you? <SignOut to="/request" className="pressable font-semibold text-on-surface underline underline-offset-4" />
      </p>
      <label className="text-field">
        <span>Player&rsquo;s name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="off" />
      </label>
      <label className="text-field">
        <span>Note for your trainer (optional)</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={300}
                  placeholder="e.g. U12 Tuesday group" />
      </label>
      {err && <p role="alert" className="text-body-sm font-semibold text-on-surface">{err}</p>}
      <button type="submit" disabled={busy} className="btn-primary pressable w-full">{busy ? 'Asking…' : 'Ask to join'}</button>
    </form>
  );
}
