import { SignIn } from '@/components/SignIn';
import { getViewer } from '@/lib/viewer';
import { ago } from '@/lib/notes';
import { ApproveRequest } from '@/components/ApproveRequest';

export const metadata = { title: 'Academy requests', robots: { index: false } };

type Req = {
  id: string; name: string; email: string; academy_name: string; slug: string | null; city: string | null;
  players: string | null; trainers: string | null; content: string | null; message: string | null;
  status: string; created_at: string;
  // From 0020; undefined before it runs.
  academy_id?: string | null; claim_code?: string | null; claimed_at?: string | null;
};

/**
 * Every "Get started" from the marketing site, newest first. Platform admins
 * only (the database enforces it). Approve makes the academy and gives the
 * trainer's claim link; they claim it, signed in with the email they asked
 * with, and set it up from a checklist (0020).
 */
export default async function RequestsPage() {
  const v = await getViewer();
  if (!v.user) return <div className="pt-8"><h1 className="h-page">Academy requests</h1><div className="mt-5"><SignIn next="/admin/requests" /></div></div>;
  if (!v.isAdmin) return <div className="pt-8"><h1 className="h-page">Admins only</h1></div>;

  const { data, error } = await v.db.from('academy_requests').select('*').order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as Req[];

  return (
    <div className="pt-8">
      <p className="eyebrow mb-3">Get started</p>
      <h1 className="h-page">Academy requests</h1>
      {error && <p className="mt-3 text-body-sm text-on-surface-variant">Couldn&rsquo;t load: {error.message}. Has migration 0006 run?</p>}
      {!error && !rows.length && <p className="mt-3 text-body text-on-surface-variant">None yet.</p>}
      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-body-lg font-bold text-on-surface">{r.academy_name}</span>
              <span className="shrink-0 text-body-sm text-on-surface-variant">{ago(r.created_at)}</span>
            </div>
            <p className="mt-1 text-body text-on-surface-variant">
              {r.name} · <a href={`mailto:${r.email}`} className="font-semibold text-on-surface underline underline-offset-2">{r.email}</a>
            </p>
            <p className="mt-2 text-body-sm leading-relaxed text-on-surface-variant">
              {[r.slug && `${r.slug}.train.futbol`, r.city, r.players && `${r.players} players`,
                r.trainers && (r.trainers === 'Just me' ? 'trainer on their own' : `${r.trainers} trainers`), r.content].filter(Boolean).join(' · ')}
            </p>
            {r.message && <p className="mt-2 whitespace-pre-line text-body leading-relaxed text-on-surface">{r.message}</p>}
            {r.status !== 'declined' && (
              <ApproveRequest id={r.id} slug={r.slug} academyName={r.academy_name} email={r.email} trainer={r.name}
                approved={r.academy_id && r.claim_code && r.slug
                  ? { slug: r.slug, code: r.claim_code, claimed: !!r.claimed_at } : null} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
