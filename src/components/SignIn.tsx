'use client';
import { LegalLinks } from './LegalLinks';
import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/client';
import { pendingPlan, pendingWorkout } from '@/lib/pending';
import { safeNext } from '@/lib/safe-next';
import { limitMessage } from '@/lib/sign-in-errors';
import { CONTACT_EMAIL } from '@/lib/legal';

/**
 * Email in, sign-in code out (the email carries a link as well). One card, both states: the form, then "check your
 * email" in the same place, so the page doesn't jump when it's sent.
 *
 * `next` is where the emailed link lands once it has signed you in. `title`
 * heads the card when the page around it doesn't already say what this is
 * for — the join page uses it for "Join as a player".
 */
const ASKED_FOR = 'signin-next';

export function SignIn({ next: given = '/me', title, button = 'Email me a sign-in code', note, recall = false }: {
  next?: string; title?: string; button?: string; note?: string;
  /** A link that failed: go where the first one was going (a claim, the trainer area), if this browser asked for it. */
  recall?: boolean;
}) {
  const [next, setNext] = useState(given);
  useEffect(() => {
    if (!recall) return;
    try {
      const kept = JSON.parse(localStorage.getItem(ASKED_FOR) ?? 'null') as { next: string; at: number } | null;
      if (kept && Date.now() - kept.at < 24 * 3600_000) setNext(safeNext(kept.next, given));
    } catch { /* storage off */ }
  }, [recall, given]);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Read after mount: localStorage doesn't exist on the server, and a line that
  // appears only after hydration is better than a hydration mismatch.
  const [waiting, setWaiting] = useState<string | null>(null);
  // On the home-screen app the email's link opens in Safari, signs in there,
  // and uses up the code with it: here it's the code or nothing.
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  }, []);
  useEffect(() => {
    const session = !!pendingWorkout.peek(), week = !!pendingPlan.peek();
    setWaiting(session && week ? 'Your last session and your week are waiting. Sign in and they’re saved.'
      : session ? 'Your last session is waiting. Sign in and it’s saved to your training.'
      : week ? 'Your week is waiting. Sign in and it’s saved as your active plan.' : null);
  }, []);

  async function send(): Promise<boolean> {
    if (!email.trim()) { setErr('Enter your email first.'); return false; }
    setErr(''); setBusy(true);
    try {
      const db = browserClient();
      const { error } = await db.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (!error) { try { localStorage.setItem(ASKED_FOR, JSON.stringify({ next, at: Date.now() })); } catch { /* storage off */ } }
      if (error) {
        console.error(error);
        // A limit says which one (this address, this network, or the app's
        // emails for the hour); anything else is the address.
        setErr(limitMessage(error, CONTACT_EMAIL) ?? 'Couldn’t send the code. Check the address and try again.');
        return false;
      }
      setSent(true);
      return true;
    } catch (e) {
      console.error(e);
      setErr('Couldn’t send the code. Try again in a moment.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const [resent, setResent] = useState(false);

  // The code in the same email signs in right here. The link can't always:
  // it opens in the mail app's browser, or Safari, never in the installed
  // app, which keeps its own sign-in apart from Safari's.
  async function verify() {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setErr('Type the code from the email.');
    setErr(''); setBusy(true);
    try {
      const { error } = await browserClient().auth.verifyOtp({ email: email.trim(), token, type: 'email' });
      // A team on one Wi-Fi checking codes together can hit the network's limit: not a wrong code.
      if (error) { setErr(limitMessage(error) ?? 'That code didn’t work. Check it, or send a new one.'); setBusy(false); return; }
      // A full load, so every page reads the new account from the start.
      window.location.assign(safeNext(next, '/me'));
    } catch {
      setErr('Couldn’t reach us. Check your signal and try again.');
      setBusy(false);
    }
  }

  if (sent) return (
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); verify(); }}>
      <div role="status">
        <div className="h-card">Check your email</div>
        <p className="mt-1.5 text-body leading-relaxed text-on-surface-variant">
          We emailed a code to <b className="font-semibold text-on-surface">{email.trim()}</b>. Type it here.
          {/* The email carries a link too. In the installed app it must not be
              tapped; with something waiting, only this browser can save it. */}
          {installed
            ? <>{' '}<b className="font-semibold text-on-surface">Don&rsquo;t tap the link in the email</b>: it opens in another browser and uses up the code.</>
            : waiting ? <>{' '}That saves what&rsquo;s waiting.</> : null}
        </p>
      </div>
      <label className="text-field mt-4">
        <span>Code</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"
               pattern="[0-9 ]*" maxLength={12} enterKeyHint="go" aria-invalid={err ? true : undefined}
               aria-describedby={err ? 'signin-error' : undefined} />
      </label>
      <button type="submit" disabled={busy} className="btn-primary pressable mt-3 w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      {err && <p id="signin-error" role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
      {resent && !err && <p role="status" className="mt-3 text-body-sm font-semibold text-on-surface">New code sent. Use the newest email.</p>}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {/* A wrong or old code: a new one to the same address, no retyping. */}
        <button type="button" disabled={busy} onClick={() => { setCode(''); setResent(false); send().then(setResent); }}
                className="min-h-11 text-body-sm font-semibold text-on-surface-variant underline underline-offset-4">
          Send a new code
        </button>
        <button type="button" onClick={() => { setSent(false); setErr(''); setCode(''); }}
                className="min-h-11 text-body-sm font-semibold text-on-surface-variant underline underline-offset-4">
          Use a different email
        </button>
      </div>
    </form>
  );

  return (
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); send(); }}>
      {title && <div className="h-card mb-1">{title}</div>}
      {/* The reason most people are here: they just finished a session. */}
      {waiting && <p className="mb-1 text-body font-medium leading-snug text-on-surface">{waiting}</p>}
      <p className="mb-4 text-body leading-snug text-on-surface-variant">
        {note ?? 'No password. We’ll email you a code.'}
      </p>
      <label className="text-field">
        <input
          value={email} onChange={(e) => setEmail(e.target.value)} type="email"
          placeholder="you@example.com" aria-label="Email"
          aria-invalid={err ? true : undefined} aria-describedby={err ? 'signin-error' : undefined}
          // inputMode + autoComplete get the right keyboard and offer the saved
          // address, which is most of what makes a mobile form feel native.
          inputMode="email" autoComplete="email" enterKeyHint="send"
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
        />
      </label>
      <button type="submit" disabled={busy} className="btn-primary pressable mt-3 w-full">
        {busy ? 'Sending…' : button}
      </button>
      {err && <p id="signin-error" role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
      <LegalLinks />
    </form>
  );
}
