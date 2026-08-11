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

  async function google() {
    const db = browserClient();
    await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/me` },
    });
  }

  if (sent) return <p className="text-sm">Check your email for the sign-in link.</p>;

  return (
    <div className="card space-y-3 p-5">
      <input
        value={email} onChange={(e) => setEmail(e.target.value)} type="email"
        placeholder="you@example.com"
        // inputMode + autoComplete get the right keyboard and offer the saved
        // address, which is most of what makes a mobile form feel native.
        inputMode="email" autoComplete="email" enterKeyHint="send"
        autoCapitalize="none" autoCorrect="off" spellCheck={false}
        className="w-full rounded-btn border border-line bg-surface2 px-4 py-3.5 text-[16px] font-medium outline-none transition focus:border-goldUi"
      />
      <button onClick={send} className="btn-gold w-full">Email me a sign-in link</button>
      <button onClick={google} className="btn-ghost w-full">Continue with Google</button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
