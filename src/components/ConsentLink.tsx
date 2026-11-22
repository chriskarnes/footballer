'use client';
import { useState, useTransition } from 'react';
import { agreeByLink, declineByLink } from '@/app/consent/actions';
import { offline } from '@/lib/plain-error';
import { KeptList } from './ConsentGate';

/** The page a parent's or guardian's emailed link opens: yes, or delete the account. */
export function ConsentLink({ token, name, academy, privacy }: { token: string; name: string; academy: string; privacy: string }) {
  const [done, setDone] = useState<'agreed' | 'deleted' | null>(null);
  const [ticked, setTicked] = useState(false);
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();

  if (done) {
    return (
      <div className="animate-pop pt-6" role="status">
        <h1 className="h-page">{done === 'agreed' ? 'Thank you' : 'Deleted'}</h1>
        <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">
          {done === 'agreed'
            ? `${name} can train now. We’ll email you tomorrow to confirm, with how to change your mind.`
            : `${name}’s account, and everything kept in it, is gone. We won’t email you again.`}
        </p>
      </div>
    );
  }

  const act = (fn: typeof agreeByLink, then: 'agreed' | 'deleted') => start(async () => {
    setErr('');
    const r = await fn(token).catch(offline);
    if (!r.ok) setErr(r.error); else setDone(then);
  });

  return (
    <div className="animate-pop pt-6">
      <h1 className="h-page">Can {name} train?</h1>
      <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">
        {name} signed up to Train.futbol to do the drills their trainer sets between practices. They&rsquo;re under 13, so a parent or guardian agrees first.
      </p>
      <KeptList name={name} academy={academy} privacy={privacy} />
      <label className="mt-5 flex cursor-pointer items-start gap-3 text-body-lg font-medium leading-snug text-on-surface">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-current" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
        <span>I&rsquo;m {name}&rsquo;s parent or guardian, and I agree to this and to the privacy policy.</span>
      </label>
      <button type="button" disabled={!ticked || busy} onClick={() => act(agreeByLink, 'agreed')} className="btn-primary btn-big pressable mt-5 w-full">
        {busy ? 'Saving…' : 'Agree'}
      </button>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}

      <div className="mt-10 border-t border-outline-variant pt-5">
        <p className="text-body font-semibold text-on-surface">Don&rsquo;t agree?</p>
        <p className="mt-1 text-body leading-relaxed text-on-surface-variant">We&rsquo;ll delete {name}&rsquo;s account and everything in it now. It can&rsquo;t be undone.</p>
        {sure ? (
          <button type="button" disabled={busy} onClick={() => act(declineByLink, 'deleted')} className="btn-ghost pressable mt-3 w-full">
            {busy ? 'Deleting…' : `Yes, delete ${name}’s account`}
          </button>
        ) : (
          <button type="button" onClick={() => setSure(true)} className="btn-ghost pressable mt-3 w-full">Delete the account</button>
        )}
      </div>
    </div>
  );
}
