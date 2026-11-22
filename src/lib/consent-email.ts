import { CONSENT_DAYS, LINK_DAYS } from './child';

/**
 * The two emails a parent or guardian gets for a player under 13 (COPPA's
 * "email plus"): the request, with the link to agree, and the confirmation
 * a day after they do. Plain words, the same list of what's kept as the
 * privacy policy, and always the way to say no.
 */

type Para = string | { label: string; href: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(subject: string, to: string, paras: Para[]) {
  const text = paras.map((p) => typeof p === 'string' ? p : `${p.label}: ${p.href}`).join('\n\n');
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:560px">${
    paras.map((p) => typeof p === 'string'
      ? `<p>${esc(p)}</p>`
      : `<p><a href="${esc(p.href)}" style="display:inline-block;padding:12px 20px;background:#1a1a1a;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">${esc(p.label)}</a></p>`).join('')
  }</div>`;
  return { to, subject, text, html };
}

const KEEP = (name: string) =>
  `What we keep about ${name}: their first name and last initial, an age range, positions and stronger foot, the training they do, and the email address the account signs in with. No photo, no address and no location.`;
const SEES = 'Who sees it: their trainer, and the people who run Train.futbol. We don’t sell it, show ads or use advertising or analytics trackers.';

/** Who the trainer is, in a sentence: one academy, or a few. */
const trainers = (academies: string[]) =>
  academies.length === 0 ? 'their trainer' : academies.length === 1 ? academies[0] : `${academies.slice(0, -1).join(', ')} and ${academies[academies.length - 1]}`;

export function requestEmail(p: { to: string; player: string; academies: string[]; link: string; privacy: string; contact: string | null }) {
  const name = p.player || 'Your player';
  return render(`Can ${name} train on Train.futbol?`, p.to, [
    'Hello,',
    `${name} has signed up to Train.futbol, where their soccer trainer (${trainers(p.academies)}) sets drills and sessions to do between practices. ${name} gave this address as a parent’s or guardian’s.`,
    `Because ${name} is under 13, a parent or guardian agrees before they train. Until then they can’t train, and we use this email address only to ask you.`,
    KEEP(name),
    SEES,
    { label: 'Agree, or have the account deleted', href: p.link },
    `The link works for ${LINK_DAYS} days. If nobody agrees within ${CONSENT_DAYS} days, we delete ${name}’s account and this email address with it.`,
    { label: 'Our privacy policy', href: p.privacy },
    p.contact
      ? `If you didn’t expect this, you can ignore it, or write to ${p.contact} and we’ll delete the account straight away.`
      : 'If you didn’t expect this, you can ignore it.',
    'Train.futbol',
  ]);
}

export function confirmEmail(p: { to: string; player: string; agreedOn: string; accountEmail: string | null; privacy: string; contact: string | null }) {
  const name = p.player || 'your player';
  return render(`You agreed: ${name} on Train.futbol`, p.to, [
    'Hello,',
    `This confirms that on ${p.agreedOn} you agreed, as ${name}’s parent or guardian, to them training on Train.futbol.`,
    KEEP(name),
    SEES,
    `You can change your mind at any time. ${p.accountEmail ? `Sign in with ${p.accountEmail}, ` : 'Sign in, '}open Me, then My profile, and choose Delete account: everything kept about ${name} goes straight away.${p.contact ? ` Or write to ${p.contact} and we’ll do it for you.` : ''}`,
    p.contact
      ? `If you didn’t agree to this, write to ${p.contact} and we’ll delete the account.`
      : 'If you didn’t agree to this, open the account and delete it, as above.',
    { label: 'Our privacy policy', href: p.privacy },
    'Train.futbol',
  ]);
}

/** "November 22, 2026", for the confirmation. */
export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
