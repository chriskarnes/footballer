import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminViewer, day, loadAcademy, n, sourceLabel } from '@/lib/admin-data';
import { ago } from '@/lib/notes';
import { headers } from 'next/headers';
import { academyOrigin } from '@/lib/tenant';
import { BackLink } from '@/components/BackLink';
import { AdminGate, Failed, RoleTag, Section, Stat, Table, Td, Th } from '@/components/admin/ui';

export const metadata = { title: 'Academy · Admin', robots: { index: false } };

/** One academy: its people, what they're doing, and what's been built. */
export default async function AdminAcademy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await adminViewer();
  if (a.gate) return <AdminGate gate={a.gate} next={`/admin/academies/${id}`} />;
  const { data: x, error } = await loadAcademy(id);
  if (error) return <div><BackLink href="/admin/academies" label="Academies" /><Failed error={error} /></div>;
  if (!x) notFound();

  const staff = x.members.filter((m) => m.role !== 'player');
  const players = x.members.filter((m) => m.role === 'player');
  const h = await headers();
  const site = academyOrigin(x.slug, `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`);
  const active = players.filter((m) => m.sessions_7d > 0).length;

  return (
    <div className="animate-pop">
      <BackLink href="/admin/academies" label="Academies" />
      <h1 className="h-page">{x.name}</h1>
      <p className="mt-2 text-body text-on-surface-variant">
        <a href={site} className="font-semibold text-on-surface underline underline-offset-4">{site.replace(/^https?:\/\//, '')}</a>
        {x.city && ` · ${x.city}`} · started {day(x.created_at)} · {x.time_zone}
        {!x.set_up && ' · still setting up'}{x.library_access && ' · Forge library on'}{!x.listed && ' · unlisted'}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Players" value={n(players.length)} sub={`${n(staff.length)} staff`} />
        <Stat label="Trained, last 7 days" value={n(active)} sub={players.length ? `of ${n(players.length)}` : undefined} />
        <Stat label="Sessions, last 7 days" value={n(players.reduce((s, m) => s + m.sessions_7d, 0))}
              sub={`${n(players.reduce((s, m) => s + m.sessions_30d, 0))} in 30 days`} />
        <Stat label="Programs" value={n(x.programs.length)} sub={`${n(x.groups.length)} ${x.groups.length === 1 ? 'group' : 'groups'} · ${n(x.drills)} own ${x.drills === 1 ? 'drill' : 'drills'}`} />
      </div>
      <p className="mt-3 text-body-sm text-on-surface-variant">
        {n(x.notes_30d)} notes sent in 30 days · AI: {n(x.ai_30d.calls)} builds{x.ai_30d.failed ? ` (${n(x.ai_30d.failed)} failed)` : ''}, {n(x.ai_30d.tokens)} tokens in 30 days
      </p>

      {!!x.waiting.length && (
        <Section title={`Waiting to be let in (${x.waiting.length})`}>
          <ul className="card mt-4 divide-y divide-outline-variant">
            {x.waiting.map((w) => (
              <li key={w.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <Link href={`/admin/users/${w.id}`} className="truncate font-bold text-on-surface hover:underline">{w.name} <span className="font-normal text-on-surface-variant">{w.email}</span></Link>
                <span className="shrink-0 text-body-sm text-on-surface-variant">{ago(w.created_at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`People (${x.members.length})`}>
        {!x.members.length ? <p className="mt-3 text-body text-on-surface-variant">No one yet.</p> : (
          <Table head={<><Th>Name</Th><Th>Role</Th><Th>Groups</Th><Th right>7d</Th><Th right>30d</Th><Th>Last session</Th><Th>Last sign-in</Th><Th>Joined</Th></>}>
            {x.members.map((m) => (
              <tr key={m.id} className="relative hover:bg-surface-container-low">
                <Td strong className="max-w-[15rem]">
                  <Link href={`/admin/users/${m.id}`} className="after:absolute after:inset-0 hover:underline">{m.name || m.email}</Link>
                  {m.name && <span className="block truncate text-body-sm font-normal text-on-surface-variant" title={m.email}>{m.email}</span>}
                </Td>
                <Td><RoleTag role={m.role} /></Td>
                <Td className="max-w-[12rem] truncate">{m.groups ?? '—'}</Td>
                <Td right>{m.role === 'player' ? n(m.sessions_7d) : '—'}</Td>
                <Td right>{m.role === 'player' ? n(m.sessions_30d) : '—'}</Td>
                <Td className="whitespace-nowrap">{m.role !== 'player' ? '—' : m.last_done ? ago(m.last_done) : 'Never'}</Td>
                <Td className="whitespace-nowrap">{m.last_sign_in_at ? ago(m.last_sign_in_at) : 'Never'}</Td>
                <Td className="whitespace-nowrap">{day(m.joined_at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <div className="grid gap-x-8 lg:grid-cols-2">
        <Section title={`Programs (${x.programs.length})`}>
          {!x.programs.length ? <p className="mt-3 text-body text-on-surface-variant">None yet.</p> : (
            <ul className="card mt-4 divide-y divide-outline-variant">
              {x.programs.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <span className="truncate font-bold text-on-surface">{p.name}</span>
                  <span className="shrink-0 text-body-sm text-on-surface-variant">{p.weeks} weeks · {n(p.sessions)} sessions</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={`Groups (${x.groups.length})`}>
          {!x.groups.length ? <p className="mt-3 text-body text-on-surface-variant">None yet.</p> : (
            <ul className="card mt-4 divide-y divide-outline-variant">
              {x.groups.map((g) => (
                <li key={g.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <span className="truncate font-bold text-on-surface">{g.name}</span>
                  <span className="shrink-0 text-body-sm text-on-surface-variant">{n(g.members)} players{g.program ? ` · ${g.program}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Latest sessions">
        {!x.recent.length ? <p className="mt-3 text-body text-on-surface-variant">No sessions finished yet.</p> : (
          <Table head={<><Th>Who</Th><Th>Session</Th><Th>Kind</Th><Th right>Min</Th><Th>When</Th></>}>
            {x.recent.map((w) => (
              <tr key={w.id} className="hover:bg-surface-container-low">
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
