import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminViewer, aiLine, day, loadAcademy, loadInactive, loadKinds, n, sourceLabel } from '@/lib/admin-data';
import { SelfServeAccess } from '@/components/admin/SelfServeAccess';
import { RemoveMember } from '@/components/admin/RemoveMember';
import { aiMonthlyLimit } from '@/lib/ai';
import { ago } from '@/lib/notes';
import { headers } from 'next/headers';
import { academyOrigin } from '@/lib/tenant';
import { BackLink } from '@/components/BackLink';
import { AdminGate, Aside, Empty, Failed, ICON, IconLink, PageHead, Pager, RoleTag, Rows, Section, Stat, Stats, Table, Tag, Td, Th } from '@/components/admin/ui';
import { FreeUntil } from '@/components/admin/FreeUntil';
import { PlayerPay } from '@/components/admin/PlayerPay';
import { readTerms } from '@/lib/membership-server';
import { BILLING_COLUMNS, billingState, type BillingRow } from '@/lib/billing';

export const metadata = { title: 'Academy · Admin', robots: { index: false } };
const PEOPLE_PER_PAGE = 50;

/** One academy: its people, what they're doing, and what's been built. */
export default async function AdminAcademy({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ people?: string }> }) {
  const { id } = await params;
  const a = await adminViewer();
  if (a.gate) return <AdminGate gate={a.gate} next={`/admin/academies/${id}`} />;
  const [{ data: x, error }, kinds, inactive] = await Promise.all([loadAcademy(id), loadKinds(), loadInactive({ academy: id })]);
  if (error) return <div><BackLink href="/admin/academies" label="Academies" /><Failed error={error} /></div>;
  if (!x) notFound();

  const staff = x.members.filter((m) => m.role !== 'player');
  const players = x.members.filter((m) => m.role === 'player');
  // The people, a page at a time: a big academy's list runs long.
  const pages = Math.max(1, Math.ceil(x.members.length / PEOPLE_PER_PAGE));
  const page = Math.max(0, Math.min(pages - 1, Math.floor(Number((await searchParams).people) || 0)));
  const shown = x.members.slice(page * PEOPLE_PER_PAGE, (page + 1) * PEOPLE_PER_PAGE);
  const off = players.filter((m) => inactive.has(`${x.id}:${m.id}`)).length;
  const h = await headers();
  const site = academyOrigin(x.slug, `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`);
  const active = players.filter((m) => m.sessions_7d > 0).length;
  // The self-serve space (0030): no owner or trainers, and an open switch.
  const kind = kinds.get(x.id);
  // Its invite link (0031): undefined when it can't be read (before 0031), null with none made.
  const invite = kind?.selfServe
    ? await a.viewer.db.rpc('admin_invite', { p_academy: x.id })
        .then((r) => (r.error ? undefined : typeof r.data === 'string' ? r.data : null), () => undefined)
    : null;

  // Billing (0037): undefined before the migration, null with nothing yet.
  const billing = kind?.selfServe ? undefined
    : await a.viewer.db.from('academy_billing').select(BILLING_COLUMNS).eq('academy_id', x.id).maybeSingle()
        .then((r) => (r.error ? undefined : (r.data as BillingRow | null)), () => undefined);

  // Who pays here (0038): null before the migration.
  const terms = await readTerms(a.viewer.db, x.id);

  return (
    <div className="animate-pop">
      <BackLink href="/admin/academies" label="Academies" />
      <PageHead title={x.name}
        tags={<>
          {kind?.selfServe ? <Tag tone="dark">Self-serve</Tag>
            : x.unclaimed ? <Tag tone="wait">Approved, not claimed yet</Tag>
            : !x.set_up && <Tag tone="wait">Still setting up</Tag>}
          {x.library_access && <Tag>Forge library</Tag>}
          {!x.listed && <Tag>Unlisted</Tag>}
        </>}
        sub={<>{site.replace(/^https?:\/\//, '')}{x.city && ` · ${x.city}`} · since {day(x.created_at)} · {x.time_zone}</>}
        actions={<IconLink href={site} label="Open its site" d={ICON.open} external />} />

      {kind?.selfServe && <SelfServeAccess id={x.id} slug={x.slug} site={site} open={kind.open} licensed={x.library_access} code={invite} />}

      <Stats>
        <Stat label="Players" value={n(players.length)} sub={`${off ? `${n(off)} inactive · ` : ''}${n(staff.length)} staff`} />
        <Stat label="Trained, last 7 days" value={n(active)} sub={players.length ? `of ${n(players.length)}` : undefined} />
        <Stat label="Sessions, last 7 days" value={n(players.reduce((s, m) => s + m.sessions_7d, 0))}
              sub={`${n(players.reduce((s, m) => s + m.sessions_30d, 0))} in 30 days`} />
        <Stat label="Programs" value={n(x.programs.length)} sub={`${n(x.groups.length)} ${x.groups.length === 1 ? 'group' : 'groups'} · ${n(x.drills)} own ${x.drills === 1 ? 'drill' : 'drills'}`} />
      </Stats>
      <p className="mt-5 text-body-sm text-on-surface-variant">
        In 30 days: {n(x.notes_30d)} notes sent · {aiLine(x.ai_30d)}{x.ai_30d.month !== undefined && ` · ${n(x.ai_30d.month)} of ${n(aiMonthlyLimit())} this month`}
      </p>
      <Aside label="How sessions are counted">
        Sessions count what players did for this academy and on their own (library, Speed, free sessions), not for another academy.
      </Aside>

      {!!x.waiting.length && (
        <Section title="Waiting to be let in" count={x.waiting.length}>
          <Rows>
            {x.waiting.map((w) => (
              <li key={w.id} className="flex items-baseline justify-between gap-3 py-4">
                <Link href={`/admin/users/${w.id}`} className="truncate font-bold text-on-surface hover:underline">{w.name} <span className="font-normal text-on-surface-variant">{w.role === 'trainer' ? 'as a trainer · ' : ''}{w.email}</span></Link>
                <span className="shrink-0 text-body-sm text-on-surface-variant">{ago(w.created_at)}</span>
              </li>
            ))}
          </Rows>
        </Section>
      )}

      {(billing !== undefined || terms) && (
        <Section title="Billing">
          <div className="mt-3 divide-y divide-outline-variant border-b border-outline-variant">
            {terms && <PlayerPay id={x.id} mode={terms.mode} priceCents={terms.priceCents} trialDays={terms.trialDays} />}
            {billing !== undefined && (!terms || terms.mode === 'trainer_pays') && (
              <FreeUntil id={x.id} until={billing?.free_until ?? null}
                status={`${billing?.status ? `Stripe: ${billing.status.replace(/_/g, ' ')}${billing.quantity != null ? `, ${n(billing.quantity)} players` : ''}. ` : ''}${billingState(billing, players.length, Date.now()).line}`} />
            )}
          </div>
        </Section>
      )}

      <Section title="People" count={x.members.length} id="people">
        {!x.members.length ? <Empty>No one yet.</Empty> : (
          <Table head={<><Th>Name</Th><Th>Role</Th><Th>Groups</Th><Th right>Sessions 7d</Th><Th>Last session</Th><Th>Last sign-in</Th>{kind?.selfServe && <Th right><span className="sr-only">Options</span></Th>}</>}>
            {shown.map((m) => (
              <tr key={m.id} className="relative hover:bg-surface-container-low">
                <Td strong className="max-w-[15rem]">
                  <Link href={`/admin/users/${m.id}`} className="after:absolute after:inset-0 hover:underline">{m.name || m.email}</Link>
                  {m.name && <span className="block truncate text-body-sm font-normal text-on-surface-variant" title={m.email}>{m.email}</span>}
                </Td>
                <Td><span className="flex flex-wrap items-center gap-1.5"><RoleTag role={m.role} />{inactive.has(`${x.id}:${m.id}`) && <Tag tone="rose">Inactive</Tag>}</span></Td>
                <Td className="max-w-[12rem] truncate">{m.groups ?? '—'}</Td>
                <Td right>{m.role === 'player' ? <><span className="text-on-surface">{n(m.sessions_7d)}</span><span className="block text-body-sm">{n(m.sessions_30d)} in 30d</span></> : '—'}</Td>
                <Td className="whitespace-nowrap">{m.role !== 'player' ? '—' : m.last_done ? ago(m.last_done) : 'Never'}</Td>
                <Td className="whitespace-nowrap"><span title={`Joined ${day(m.joined_at)}`}>{m.last_sign_in_at ? ago(m.last_sign_in_at) : 'Never'}</span></Td>
                {kind?.selfServe && (
                  <Td right className="py-2">{m.role === 'player' && <RemoveMember academyId={x.id} userId={m.id} name={m.name || m.email} />}</Td>
                )}
              </tr>
            ))}
          </Table>
        )}
        <Pager page={page} per={PEOPLE_PER_PAGE} total={x.members.length} label="Pages of people"
               href={(p) => `/admin/academies/${x.id}${p ? `?people=${p}` : ''}#people`} />
      </Section>

      <div className="grid gap-x-14 lg:grid-cols-2">
        <Section title="Programs" count={x.programs.length}>
          {!x.programs.length ? <Empty>None yet.</Empty> : (
            <Rows>
              {x.programs.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 py-4">
                  <span className="truncate font-bold text-on-surface">{p.name}</span>
                  <span className="shrink-0 text-body-sm text-on-surface-variant">{p.weeks} weeks · {n(p.sessions)} sessions</span>
                </li>
              ))}
            </Rows>
          )}
        </Section>
        <Section title="Groups" count={x.groups.length}>
          {!x.groups.length ? <Empty>None yet.</Empty> : (
            <Rows>
              {x.groups.map((g) => (
                <li key={g.id} className="flex items-baseline justify-between gap-3 py-4">
                  <span className="truncate font-bold text-on-surface">{g.name}</span>
                  <span className="shrink-0 text-body-sm text-on-surface-variant">{n(g.members)} players{g.program ? ` · ${g.program}` : ''}</span>
                </li>
              ))}
            </Rows>
          )}
        </Section>
      </div>

      <Section title="Latest sessions">
        {!x.recent.length ? <Empty>No sessions finished yet.</Empty> : (
          <Table head={<><Th>Who</Th><Th>Session</Th><Th>Kind</Th><Th right>Min</Th><Th>When</Th></>}>
            {x.recent.map((w) => (
              <tr key={w.id}>
                <Td strong><Link href={`/admin/users/${w.user_id}`} className="hover:underline">{w.who}</Link></Td>
                <Td><span className="text-on-surface">{w.title}</span>{w.feel && <span className="block text-body-sm">felt {w.feel}</span>}</Td>
                <Td>{sourceLabel(w.source)}</Td>
                <Td right>{w.minutes != null ? Math.round(w.minutes) : '—'}</Td>
                <Td className="whitespace-nowrap">{ago(w.at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
