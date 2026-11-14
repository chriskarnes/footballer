'use client';
import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/client';
import { pendingPlan, pendingWorkout } from '@/lib/pending';

/**
 * Email in, magic link out. One card, both states: the form, then "check your
 * email" in the same place, so the page doesn't jump when it's sent.
 *
 * `next` is where the emailed link lands once it has signed you in. `title`
 * heads the card when the page around it doesn't already say what this is
 * for — the join page uses it for "Join as a player".
 */
export function SignIn({ next = '/me', title, button = 'Email me a sign-in code', note }: {
  next?: string; title?: string; button?: string; note?: string;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Read after mount: localStorage doesn't exist on the server, and a line that
  // appears only after hydration is better than a hydration mismatch.
  const [waiting, setWaiting] = useState<string | null>(null);
  useEffect(() => {
    const session = !!pendingWorkout.peek(), week = !!pendingPlan.peek();
    setWaiting(session && week ? 'Your last session and your week are waiting. Sign in and they’re saved.'
      : session ? 'Your last session is waiting. Sign in and it’s saved to your training.'
      : week ? 'Your week is waiting. Sign in and it’s saved as your active plan.' : null);
  }, []);

  async function send() {
    if (!email.trim()) return setErr('Enter your email first.');
    setErr(''); setBusy(true);
    try {
      const db = browserClient();
      const { error } = await db.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        console.error(error);
        // Supabase allows one link a minute per address; anything else is ours.
        setErr(error.status === 429 || /rate|seconds/i.test(error.message)
          ? 'A link was just sent. Wait a minute, then try again.'
          : 'Couldn’t send the link. Check the address and try again.');
      } else setSent(true);
    } catch (e) {
      console.error(e);
      setErr('Couldn’t send the link. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  // The code in the same email signs in right here. The link can't always:
  // it opens in the mail app's browser, or Safari, never in the installed
  // app, which keeps its own sign-in apart from Safari's.
  async function verify() {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setErr('Type the code from the email.');
    setErr(''); setBusy(true);
    try {
      const { error } = await browserClient().auth.verifyOtp({ email: email.trim(), token, type: 'email' });
      if (error) { setErr('That code didn’t work. Check it, or send a new one.'); setBusy(false); return; }
      // A full load, so every page reads the new account from the start.
      window.location.assign(next);
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
          We sent a sign-in email to <b className="font-semibold text-on-surface">{email.trim()}</b>.
          {' '}Type the code from it here, or open its link on this phone{waiting ? ', in this browser, so what’s waiting can be saved' : ''}.
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
      <button type="button" onClick={() => { setSent(false); setErr(''); setCode(''); }}
              className="mt-4 text-body-sm font-semibold text-on-surface-variant underline underline-offset-4">
        Use a different email
      </button>
    </form>
  );

  return (
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); send(); }}>
      {title && <div className="h-card mb-1">{title}</div>}
      {/* The reason most people are here: they just finished a session. */}
      {waiting && <p className="mb-1 text-body font-medium leading-snug text-on-surface">{waiting}</p>}
      <p className="mb-4 text-body leading-snug text-on-surface-variant">
        {note ?? 'No password. We’ll email you a code and a link.'}
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
    </form>
  );
}
