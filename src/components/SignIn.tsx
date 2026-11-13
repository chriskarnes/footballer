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
export function SignIn({ next = '/me', title, button = 'Email me a sign-in link', note }: {
  next?: string; title?: string; button?: string; note?: string;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
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

  if (sent) return (
    <div className="card p-5" role="status">
      <div className="h-card">Check your email</div>
      <p className="mt-1.5 text-body leading-relaxed text-on-surface-variant">
        We sent a sign-in link to <b className="font-semibold text-on-surface">{email.trim()}</b>.
        {/* The link has to open in this browser to find the session — say so,
            since a mail app's own browser is where it usually opens. */}
        {' '}Open it on this phone{waiting ? ', in this browser, so what’s waiting can be saved' : ''}.
      </p>
      <button type="button" onClick={() => { setSent(false); setErr(''); }}
              className="mt-4 text-body-sm font-semibold text-on-surface-variant underline underline-offset-4">
        Use a different email
      </button>
    </div>
  );

  return (
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); send(); }}>
      {title && <div className="h-card mb-1">{title}</div>}
      {/* The reason most people are here: they just finished a session. */}
      {waiting && <p className="mb-1 text-body font-medium leading-snug text-on-surface">{waiting}</p>}
      <p className="mb-4 text-body leading-snug text-on-surface-variant">
        {note ?? 'No password. We’ll email you a link.'}
      </p>
      <label className="text-field">
        <input
          value={email} onChange={(e) => setEmail(e.target.value)} type="email"
          placeholder="you@example.com" aria-label="Email"
          // inputMode + autoComplete get the right keyboard and offer the saved
          // address, which is most of what makes a mobile form feel native.
          inputMode="email" autoComplete="email" enterKeyHint="send"
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
        />
      </label>
      <button type="submit" disabled={busy} className="btn-primary pressable mt-3 w-full">
        {busy ? 'Sending…' : button}
      </button>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
    </form>
  );
}
