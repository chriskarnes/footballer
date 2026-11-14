'use client';
import { useState, useTransition } from 'react';
import { joinAcademy } from '@/app/join/actions';
import { SignOut } from './SignOut';
import { offline } from '@/lib/plain-error';

/** The last step for someone already signed in: one card, one button. */
export function JoinButton({ code, label, email, who }: { code: string; label: string; email: string; who?: 'player' | 'parent' }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [asked, setAsked] = useState(false);
  if (asked) return <TrainerAsked email={email} code={code} />;
  return (
    <div className="card p-5">
      <div className="h-card">{label}</div>
      {/* A shared phone: whoever signed in last isn't always who's joining. */}
      <p className="mt-1 text-body text-on-surface-variant">
        Signed in as {email}. Not you? <SignOut to={`/join/${code}${who ? `?as=${who}` : ''}`} className="pressable font-semibold text-on-surface underline underline-offset-4" />
      </p>
      <button type="button" disabled={pending} className="btn-primary pressable mt-4 w-full"
              onClick={() => start(async () => { const r = await joinAcademy(code, who).catch(offline); if (r && !r.ok) setErr(r.error); else if (r && 'asked' in r) setAsked(true); })}>
        {pending ? 'Joining…' : 'Join'}
      </button>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    </div>
  );
}

/** A trainer invite, sent: the owner lets them in (0027). */
export function TrainerAsked({ email, code, declined }: { email: string; code: string; declined?: boolean }) {
  const [again, setAgain] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  if (declined && !again) return (
    <div className="card p-5" role="status">
      <div className="h-card">Not let in</div>
      <p className="mt-1 text-body text-on-surface-variant">
        The academy&rsquo;s owner didn&rsquo;t let this account in as a trainer. If that was a mistake, ask them, then ask again here.
      </p>
      <p className="mt-2 text-body text-on-surface-variant">
        Signed in as {email}. Not you? <SignOut to={`/join/${code}`} className="pressable font-semibold text-on-surface underline underline-offset-4" />
      </p>
      <button type="button" disabled={pending} className="btn-ghost pressable mt-4 w-full"
              onClick={() => start(async () => { const r = await joinAcademy(code).catch(offline); if (r && !r.ok) setErr(r.error); else setAgain(true); })}>
        {pending ? 'Asking…' : 'Ask again'}
      </button>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    </div>
  );
  return (
    <div className="card p-5" role="status">
      <div className="h-card">Asked</div>
      <p className="mt-1 text-body text-on-surface-variant">
        The academy&rsquo;s owner lets trainers in. You&rsquo;ll see every player here once they do.
      </p>
      <p className="mt-2 text-body text-on-surface-variant">
        Signed in as {email}. Not you? <SignOut to={`/join/${code}`} className="pressable font-semibold text-on-surface underline underline-offset-4" />
      </p>
    </div>
  );
}
