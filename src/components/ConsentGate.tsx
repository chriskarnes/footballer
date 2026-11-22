'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { agreeHere, askParent } from '@/app/consent/actions';
import { offline } from '@/lib/plain-error';
import { CONSENT_DAYS } from '@/lib/child';
import { SignOut } from './SignOut';

export type ConsentGateProps = {
  how: 'here' | 'email';
  name: string;
  academy: string;
  sentTo: string | null;
  accountEmail: string | null;
  privacy: string;
};

/** What's kept and who sees it: the same as the privacy policy says, for a player under 13. */
export function KeptList({ name, academy, privacy }: { name: string; academy: string; privacy: string }) {
  return (
    <div className="mt-5 space-y-3 rounded-large bg-surface-container-high p-4 text-body leading-relaxed text-on-surface">
      <p><b>What we keep about {name}:</b> first name and last initial, an age range, positions and stronger foot, the training they do, and the email the account signs in with. No photo, no address, no location.</p>
      <p><b>Who sees it:</b> their trainer at {academy}, and the people who run Train.futbol. We don&rsquo;t sell it, show ads or use trackers.</p>
      <p><a href={privacy} className="font-semibold underline underline-offset-4">The privacy policy</a> has the rest.</p>
    </div>
  );
}

/**
 * In place of training, for a player under 13 with no parent's or guardian's
 * agreement on file (0043). Two ways through: the parent is the one signed
 * in (they joined as a parent) and agrees here; or the player gives a
 * parent's email and the parent agrees from the link it gets.
 */
export function ConsentGate(p: ConsentGateProps) {
  return p.how === 'here' ? <AgreeHere {...p} /> : <AskByEmail {...p} />;
}

function AgreeHere({ name, academy, accountEmail, privacy }: ConsentGateProps) {
  const router = useRouter();
  const [ticked, setTicked] = useState(false);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  return (
    <div className="animate-pop pt-6">
      <h1 className="h-page">Before {name} trains</h1>
      <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">
        {name} is under 13, so a parent or guardian agrees first. It takes a moment.
      </p>
      <KeptList name={name} academy={academy} privacy={privacy} />
      <label className="mt-5 flex cursor-pointer items-start gap-3 text-body-lg font-medium leading-snug text-on-surface">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-current" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
        <span>I&rsquo;m {name}&rsquo;s parent or guardian, and I agree to this and to the privacy policy.</span>
      </label>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
      <button type="button" disabled={!ticked || busy} className="btn-primary btn-big pressable mt-5 w-full"
              onClick={() => start(async () => {
                setErr('');
                const r = await agreeHere().catch(offline);
                if (!r.ok) setErr(r.error); else router.refresh();
              })}>
        {busy ? 'Saving…' : 'Agree'}
      </button>
      <p className="mt-4 text-body-sm leading-relaxed text-on-surface-variant">
        We&rsquo;ll email {accountEmail ?? 'this account'} to confirm. You can change your mind any time: delete the account under Me, then My profile.
      </p>
      <p className="mt-6 text-body text-on-surface-variant">
        Not {name}&rsquo;s parent or guardian? <SignOut to="/me" className="pressable font-semibold text-on-surface underline underline-offset-4" />
      </p>
    </div>
  );
}

function AskByEmail({ name, sentTo, privacy, academy }: ConsentGateProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(!sentTo);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const send = (to: string) => start(async () => {
    setErr('');
    const r = await askParent(to).catch(offline);
    if (!r.ok) setErr(r.error); else { setEditing(false); router.refresh(); }
  });
  return (
    <div className="animate-pop pt-6">
      <h1 className="h-page">Ask a parent or guardian</h1>
      <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">
        You&rsquo;re under 13, so a parent or guardian says yes before you train. We&rsquo;ll email them a link.
      </p>
      {!editing && sentTo ? (
        <div className="card mt-5 p-5" role="status">
          <div className="h-card">Sent to {sentTo}</div>
          <p className="mt-1.5 text-body leading-relaxed text-on-surface-variant">
            When they open it and tap Agree, you can train. Ask them to check their spam folder if it isn&rsquo;t there.
          </p>
          <button type="button" onClick={() => router.refresh()} className="btn-primary pressable mt-4 w-full">They&rsquo;ve agreed</button>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-body-sm font-semibold text-on-surface-variant">
            <button type="button" disabled={busy} onClick={() => send(sentTo)} className="underline underline-offset-4">{busy ? 'Sending…' : 'Send it again'}</button>
            <button type="button" onClick={() => setEditing(true)} className="underline underline-offset-4">Use a different email</button>
          </div>
        </div>
      ) : (
        <form className="mt-5" onSubmit={(e) => { e.preventDefault(); send(email); }}>
          <label className="text-field">
            <span>Parent&rsquo;s or guardian&rsquo;s email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} autoComplete="off" inputMode="email" />
          </label>
          <button type="submit" disabled={busy || !email.trim()} className="btn-primary btn-big pressable mt-4 w-full">{busy ? 'Sending…' : 'Send'}</button>
        </form>
      )}
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
      <KeptList name={name} academy={academy} privacy={privacy} />
      <p className="mt-4 text-body-sm leading-relaxed text-on-surface-variant">
        Their email is used only to ask them and to confirm. If nobody agrees in {CONSENT_DAYS} days, this account is deleted.
      </p>
    </div>
  );
}
