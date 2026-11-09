import Link from 'next/link';
import { BackLink } from '@/components/BackLink';
import { staffOnly } from '@/components/coach/Gate';
import { InviteLink } from '@/components/coach/InviteLink';
import { ROOT_DOMAIN } from '@/lib/tenant';

export const metadata = { title: 'Team', robots: { index: false } };

type Staff = { user_id: string; role: string; email: string | null; display_name: string | null };

/**
 * The academy itself: who trains here, the two invite links, and — for the
 * owner — the brand. Every trainer sees every player, so there's nothing to
 * assign; adding a trainer is sending them a link.
 */
export default async function TeamPage() {
  const gate = await staffOnly('/coach/team');
  if ('page' in gate) return gate.page;
  const { db, academy, role, canBrand } = gate.viewer;

  const [{ data: staff }, { data: invites }] = await Promise.all([
    db.rpc('academy_staff', { p_academy: academy.id }),
    db.from('academy_invites').select('code, role').eq('academy_id', academy.id),
  ]);
  const code = (r: string) => (invites ?? []).find((i: { role: string }) => i.role === r)?.code as string | undefined;
  const owner = role === 'owner';

  return (
    <div className="animate-pop">
      <BackLink href="/coach" label="Players" />
      <p className="eyebrow mb-3">{academy.slug}.{ROOT_DOMAIN}</p>
      <h1 className="h-page">{academy.name}</h1>

      <section className="mt-8">
        <p className="eyebrow mb-3">Trainers</p>
        <ul className="card divide-y divide-outline-variant">
          {((staff ?? []) as Staff[]).map((s) => (
            <li key={s.user_id} className="flex min-h-[52px] items-center justify-between gap-4 px-4">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-on-surface">{s.display_name || s.email}</span>
                {s.display_name && <span className="block truncate text-[12px] text-on-surface-variant">{s.email}</span>}
              </span>
              <span className="tag shrink-0">{s.role === 'owner' ? 'Owner' : 'Trainer'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-9">
        <p className="eyebrow mb-3">Invite players</p>
        <div className="card p-5">
          <p className="text-[13.5px] leading-snug text-on-surface-variant">For players and parents. They join as players.</p>
          {code('player') && <InviteLink path={`/join/${code('player')}`} role="player" />}
        </div>
      </section>

      {owner && (
        <section className="mt-9">
          <p className="eyebrow mb-3">Invite a trainer</p>
          <div className="card p-5">
            <p className="text-[13.5px] leading-snug text-on-surface-variant">
              Only send this to people who coach with you. Trainers see every player and their notes.
            </p>
            {code('trainer') && <InviteLink path={`/join/${code('trainer')}`} role="trainer" />}
          </div>
        </section>
      )}

      {canBrand && (
        <Link href="/admin" className="card pressable mt-9 flex min-h-[56px] items-center justify-between px-4">
          <span className="text-[14px] font-semibold text-on-surface">Brand settings</span>
          <span className="text-[13px] text-on-surface-variant">Name, colours, logo ›</span>
        </Link>
      )}
    </div>
  );
}
