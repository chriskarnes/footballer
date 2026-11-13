import Link from 'next/link';
import { PageHead } from '@/components/coach/PageHead';
import { staffOnly } from '@/components/coach/Gate';
import { InviteLink } from '@/components/coach/InviteLink';
import { ROOT_DOMAIN } from '@/lib/tenant';
import { BuildDefaults } from '@/components/coach/BuildDefaults';
import { PlayerOptions } from '@/components/coach/PlayerOptions';
import { loadDefaults } from '@/lib/academy-data';
import { usage } from '@/lib/ai';
import { readSetup } from '@/lib/setup';
import { ListedSwitch } from '@/components/coach/Setup';

export const metadata = { title: 'Academy', robots: { index: false } };

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

  const [{ data: staff }, { data: invites }, defaults, ai, setup] = await Promise.all([
    db.rpc('academy_staff', { p_academy: academy.id }),
    db.from('academy_invites').select('code, role').eq('academy_id', academy.id),
    loadDefaults(db, academy.id),
    usage(db, academy.id, academy.timeZone),
    readSetup(db, academy.id),
  ]);
  const code = (r: string) => (invites ?? []).find((i: { role: string }) => i.role === r)?.code as string | undefined;
  const owner = role === 'owner';

  return (
    <div className="animate-pop">
      <PageHead title={academy.name} eyebrow={`${academy.slug}.${ROOT_DOMAIN}`} />

      <section className="mt-8">
        <p className="eyebrow mb-3">Trainers</p>
        <ul className="card divide-y divide-outline-variant">
          {((staff ?? []) as Staff[]).map((s) => (
            <li key={s.user_id} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-on-surface">{s.display_name || s.email}</span>
                {s.display_name && <span className="mt-0.5 block truncate text-[13px] text-on-surface-variant">{s.email}</span>}
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-on-surface-variant">{s.role === 'owner' ? 'Owner' : 'Trainer'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="invite" className="mt-9 scroll-mt-6">
        <p className="eyebrow mb-3">Invite links</p>
        <div className="card divide-y divide-outline-variant">
          <div className="p-5">
            <div className="text-[14px] font-semibold text-on-surface">For players and parents</div>
            {code('player')
              ? <InviteLink path={`/join/${code('player')}`} role="player" />
              : <p className="mt-2 text-[14px] text-on-surface-variant">No link yet.</p>}
          </div>
          {owner && (
            <div className="p-5">
              <div className="text-[14px] font-semibold text-on-surface">For trainers</div>
              <p className="mt-0.5 text-[14px] text-on-surface-variant">Trainers see every player and every note.</p>
              {code('trainer')
                ? <InviteLink path={`/join/${code('trainer')}`} role="trainer" />
                : <p className="mt-2 text-[14px] text-on-surface-variant">No link yet.</p>}
            </div>
          )}
        </div>
      </section>

      <section className="mt-9">
        <p className="eyebrow mb-3">Training</p>
        <div className="space-y-3">
          <BuildDefaults defaults={defaults} ai={ai} />
          <PlayerOptions library={defaults.playerLibrary} extras={defaults.playerExtras} speed={defaults.playerSpeed} />
        </div>
      </section>

      {owner && setup.ready && (
        <section className="mt-9">
          <p className="eyebrow mb-3">Finding you</p>
          <div className="card p-5">
            {setup.done
              ? <ListedSwitch initial={setup.listed} />
              : <p className="text-[14px] text-on-surface-variant">Players can find you by name once you finish setup.</p>}
          </div>
          {/* The checklist, any time: the way back to it once it's off the dashboard. */}
          <Link href="/coach/setup" className="card pressable mt-3 flex min-h-[56px] items-center justify-between px-4">
            <span className="text-[14px] font-semibold text-on-surface">Setup checklist</span>
            <span className="text-[14px] text-on-surface-variant">{setup.done ? 'Done ›' : 'Continue ›'}</span>
          </Link>
        </section>
      )}

      {canBrand && (
        <Link href="/coach/brand" className="card pressable mt-9 flex min-h-[56px] items-center justify-between px-4">
          <span className="text-[14px] font-semibold text-on-surface">Brand settings</span>
          <span className="text-[14px] text-on-surface-variant">Name, colours, logo ›</span>
        </Link>
      )}
    </div>
  );
}
