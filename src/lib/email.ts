import 'server-only';
import { CONTACT_EMAIL } from './legal';

/**
 * Email the app sends itself, through Resend's API: the parent-or-guardian
 * agreement for a player under 13, and its confirmation. Sign-in emails are
 * Supabase's own and don't come through here.
 *
 * Off until RESEND_API_KEY is set (an API key from the Resend account that
 * already sends the sign-in emails for train.futbol). Replies go to the
 * contact address the privacy policy gives.
 */
export const emailOn = () => !!process.env.RESEND_API_KEY;

const FROM = () => process.env.EMAIL_FROM?.trim() || 'Train.futbol <hello@train.futbol>';

export type Email = { to: string; subject: string; text: string; html: string };

/** True once Resend has taken it. Never throws: a failed send is logged and said. */
export async function sendEmail(m: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM(), to: [m.to], subject: m.subject, text: m.text, html: m.html,
        ...(CONTACT_EMAIL ? { reply_to: CONTACT_EMAIL } : {}),
      }),
    });
    if (!res.ok) console.error('sendEmail', res.status, (await res.text().catch(() => '')).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error('sendEmail', e);
    return false;
  }
}
