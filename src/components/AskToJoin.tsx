'use client';
import { useState, useTransition } from 'react';
import { askToJoin } from '@/app/request/actions';
import { SignOut } from '@/components/SignOut';
import { offline } from '@/lib/plain-error';
import { CheckIcon } from '@/components/Chip';

/** Who you are, in words the trainer will recognise, and one button. */
export function AskToJoin({ academy, email, pending: wasPending, declined }: {
  academy: string; email: string; pending: boolean;
  /** Asked before and turned down (0027): said, not silently a fresh form. */
  declined?: boolean;
}) {
  const [sent, setSent] = useState(wasPending);
  const [member, setMember] = useState(false);
  const [name, setName] = useState('');
  // Whose email this is: the questions after are worded for them (0027).
  const [who, setWho] = useState<'player' | 'parent' | null>(null);
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
        {/* A family phone: say whose request this is, and give the way out. */}
        <p className="mt-3 text-body text-on-surface-variant">
          Signed in as {email}. Not you? <SignOut to="/request" className="pressable font-semibold text-on-surface underline underline-offset-4" />
        </p>
        <button type="button" onClick={() => setSent(false)}
                className="mt-3 text-body-sm font-semibold text-on-surface-variant underline underline-offset-4">
          Change the name or note
        </button>
      </div>
    );
  }

  return (
    <form className="card space-y-4 p-5" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        if (!who) { setErr('Say whether you’re the player or a parent.'); return; }
        const r = await askToJoin(name, message, who).catch(offline);
        if (!r.ok) setErr(r.error); else if ('member' in r && r.member) setMember(true); else setSent(true);
      });
    }}>
      <p className="text-body text-on-surface-variant">
        Signed in as {email}. Not you? <SignOut to="/request" className="pressable font-semibold text-on-surface underline underline-offset-4" />
      </p>
      {declined && (
        <p className="rounded-medium bg-surface-container-high p-3 text-body text-on-surface">
          {academy} didn&rsquo;t let this account in last time. If that was a mistake, check with them and ask again.
        </p>
      )}
      <fieldset>
        <legend className="text-body font-semibold text-on-surface">Who&rsquo;s asking?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['player', 'parent'] as const).map((w) => (
            <button key={w} type="button" aria-pressed={who === w} onClick={() => { setWho(w); setErr(''); }}
                    className={`chip pressable ${who === w ? 'chip-on' : ''}`}>
              <CheckIcon />{w === 'player' ? 'I’m the player' : 'I’m a parent'}
            </button>
          ))}
        </div>
      </fieldset>
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
