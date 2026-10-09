'use client';
import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/client';
import { pendingPlan, pendingWorkout } from '@/lib/pending';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  // Read after mount: localStorage doesn't exist on the server, and a line that
  // appears only after hydration is better than a hydration mismatch.
  const [waiting, setWaiting] = useState<string | null>(null);
  useEffect(() => {
    const session = !!pendingWorkout.peek(), week = !!pendingPlan.peek();
    setWaiting(session && week ? 'Your last session and your week are waiting. Sign in and they’re saved.'
      : session ? 'Your last session is waiting. Sign in and it’s saved to your training.'
      : week ? 'Your week is waiting. Sign in and it’s saved as the plan you follow.' : null);
  }, []);

  async function send() {
    setErr('');
    try {
      const db = browserClient();
      const { error } = await db.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/me` },
      });
      if (error) setErr(error.message); else setSent(true);
    } catch {
      setErr('Supabase not configured yet — add your keys to .env.local');
    }
  }

  if (sent) return (
    <p className="text-sm">
      Check your email for the sign-in link.
      {/* The link has to open in this browser to find the session — say so,
          since a mail app's own browser is where it usually opens. */}
      {waiting && ' Open it on this phone, in this browser, so what’s waiting can be saved.'}
    </p>
  );

  return (
    <div className="card space-y-3 p-5">
      {/* The reason most people are here: they just finished a session. */}
      {waiting && (
        <p className="text-[14px] font-medium text-on-surface">
          {waiting}
        </p>
      )}
      {/* The same .text-field the profile form uses. This was its own input
          with a 16px radius, a low-contrast border and a grey fill — one of
          three different text fields in the app. */}
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
      <button onClick={send} className="btn-primary pressable w-full">Email me a sign-in link</button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
