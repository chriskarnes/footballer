import { LINK_DAYS, shortName } from '@/lib/child';
import { hashToken, playerAcademies } from '@/lib/consent-server';
import { serviceDb } from '@/lib/service-db';
import { rootHref } from '@/lib/root-link';
import { ConsentLink } from '@/components/ConsentLink';

export const metadata = { title: 'Agree', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Where the link in a parent's or guardian's email lands (0043): who it's
 * for, what's kept, and the two answers. No sign-in: the link is the key,
 * it's kept only as a hash, and it works once, for LINK_DAYS days.
 */
export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await lookup(token);
  const privacy = await rootHref('/privacy');
  if (!found) {
    return (
      <div className="animate-pop pt-6">
        <h1 className="h-page">This link has run out</h1>
        <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">
          It was already used, or it&rsquo;s more than {LINK_DAYS} days old. If your player still needs you to agree, ask them to send a new one from the app.
        </p>
      </div>
    );
  }
  return <ConsentLink token={token} name={found.name} academy={found.academy} privacy={privacy} />;
}

async function lookup(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = serviceDb();
  if (!db) return null;
  const { data } = await db.from('parent_consents').select('user_id, requested_at').eq('token_hash', hashToken(token)).maybeSingle();
  const row = data as { user_id: string; requested_at: string | null } | null;
  if (!row?.requested_at || Date.now() - Date.parse(row.requested_at) > LINK_DAYS * 86_400_000) return null;
  const [{ data: prof }, academies] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', row.user_id).maybeSingle(),
    playerAcademies(db, row.user_id),
  ]);
  return {
    name: shortName(prof?.display_name as string | null).split(' ')[0] || 'Your player',
    academy: academies.join(', ') || 'their trainer',
  };
}
