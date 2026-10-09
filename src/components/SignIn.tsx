'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase/client';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

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

  if (sent) return <p className="text-sm">Check your email for the sign-in link.</p>;

  return (
    <div className="card space-y-3 p-5">
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
