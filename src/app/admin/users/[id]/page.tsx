import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminViewer, day, loadUser, n, sourceLabel } from '@/lib/admin-data';
import { ago } from '@/lib/notes';
import { BackLink } from '@/components/BackLink';
import { AdminGate, Failed, RoleTag, Section, Stat, Table, Td, Th } from '@/components/admin/ui';

export const metadata = { title: 'Person · Admin', robots: { index: false } };

/** One account: who they are, where they belong, and what they've done. */
export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await adminViewer();
  if (a.gate) return <AdminGate gate={a.gate} next={`/admin/users/${id}`} />;
  const { data: u, error } = await loadUser(id);
  if (error) return <div><BackLink href="/admin/users" label="People" /><Failed error={error} /></div>;
  if (!u) notFound();

  const p = u.profile;
  const done = u.workouts.filter((w) => w.status === 'completed');
  const about = p && [p.positions?.length ? p.positions.join(', ') : null, p.age_band, p.level,
                      p.dominant_foot && `${p.dominant_foot} foot`, p.club, p.region].filter(Boolean).join(' · ');

  return (
    <div className="animate-pop">
      <BackLink href="/admin/users" label="People" />
      <h1 className="h-page">{p?.name || u.email}</h1>
      <p className="mt-2 text-body text-on-surface-variant">
        <a href={`mailto:${u.email}`} className="font-semibold text-on-surface underline underline-offset-4">{u.email}</a>
        {' '}· joined {day(u.created_at)} · last signed in {u.last_sign_in_at ? ago(u.last_sign_in_at) : 'never'}
        {!u.confirmed_at && ' · email not confirmed'}{u.admin && ' · platform admin'}
      </p>
      {about && <p className="mt-1 text-body-sm text-on-surface-variant">{about}{p?.signed_up_by ? ` · signed up by ${p.signed_up_by}` : ''}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sessions" value={n(u.sessions_all)} sub={`${n(u.minutes_all)} minutes in all`} />
        <Stat label="Last session" value={done[0] ? ago(done[0].at) : '—'} sub={done[0]?.title} />
        <Stat label="Notes" value={n(u.notes.received)} sub={`${n(u.notes.unread)} unread · ${n(u.notes_sent)} sent`} />
        <Stat label="Speed tests" value={n(p?.speed_tests ?? 0)} sub={u.plan ? `Plan: ${u.plan.name ?? 'their own'} · ${u.plan.days} slots` : 'No plan'} />
      </div>

      <Section title="Academies">
        {!u.academies.length && !u.asking.length
          ? <p className="mt-3 text-body text-on-surface-variant">In no academy.</p>
          : (
            <ul className="card mt-4 divide-y divide-outline-variant">
              {u.academies.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/academies/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-container-low">
                    <span className="flex min-w-0 items-center gap-2"><RoleTag role={m.role} /><span className="truncate font-bold text-on-surface">{m.name}</span></span>
                    <span className="shrink-0 text-body-sm text-on-surface-variant">since {day(m.joined_at)}</span>
                  </Link>
                </li>
              ))}
              {u.asking.map((m) => (
                <li key={`ask-${m.id}`}>
                  <Link href={`/admin/academies/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-container-low">
                    <span className="truncate font-bold text-on-surface">{m.name}</span>
                    <span className="shrink-0 text-body-sm text-on-surface-variant">asked to join {ago(m.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </Section>

      <Section title={`Sessions (latest ${u.workouts.length})`}>
        {!u.workouts.length ? <p className="mt-3 text-body text-on-surface-variant">None yet.</p> : (
          <Table head={<><Th>Session</Th><Th>Kind</Th><Th>Status</Th><Th right>Min</Th><Th right>Touches</Th><Th>When</Th></>}>
            {u.workouts.map((w) => (
              <tr key={w.id} className="hover:bg-surface-container-low">
                <Td strong>{w.title}{w.feel && <span className="block text-body-sm font-normal text-on-surface-variant">felt {w.feel}</span>}</Td>
                <Td>{sourceLabel(w.source)}</Td>
                <Td>{w.status === 'completed' ? 'Done' : w.status === 'in_progress' ? 'Started' : 'Planned'}</Td>
                <Td right>{w.minutes != null ? Math.round(w.minutes) : '—'}</Td>
                <Td right>{w.touches != null ? n(w.touches) : '—'}</Td>
                <Td className="whitespace-nowrap">{ago(w.at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
