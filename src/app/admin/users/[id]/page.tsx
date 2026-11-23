import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminViewer, day, forWhom, loadInactive, loadUser, n, sourceLabel } from '@/lib/admin-data';
import { ago } from '@/lib/notes';
import { BackLink } from '@/components/BackLink';
import { AGE_LABEL } from '@/lib/positions';
import { AgeFix } from '@/components/admin/AgeFix';
import { CONSENT_DAYS, isUnder13 } from '@/lib/child';
import { serviceDb } from '@/lib/service-db';
import { AdminGate, Empty, Failed, ICON, IconLink, PageHead, RoleTag, Rows, Section, Stat, Stats, Table, Tag, Td, Th } from '@/components/admin/ui';

export const metadata = { title: 'Person · Admin', robots: { index: false } };

/** One account: who they are, where they belong, and what they've done. */
export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await adminViewer();
  if (a.gate) return <AdminGate gate={a.gate} next={`/admin/users/${id}`} />;
  const { data: u, error } = await loadUser(id);
  if (error) return <div><BackLink href="/admin/users" label="People" /><Failed error={error} /></div>;
  if (!u) notFound();

  const inactive = await loadInactive({ users: [u.id] });
  const p = u.profile;
  const done = u.workouts.filter((w) => w.status === 'completed');
  // 0027 sends the last one done even when the list below is cut short.
  const last = u.last_done !== undefined ? u.last_done : done[0]?.at;
  const consent = isUnder13(p?.age_band) ? await consentLine(u.id) : null;
  const about = p && [p.positions?.length ? p.positions.join(', ') : null, p.age_band && (AGE_LABEL[p.age_band] ?? p.age_band), p.level,
                      p.dominant_foot && `${p.dominant_foot} foot`, p.club, p.region].filter(Boolean).join(' · ');

  return (
    <div className="animate-pop">
      <BackLink href="/admin/users" label="People" />
      <PageHead title={p?.name || u.email}
        tags={(u.admin || !u.confirmed_at) && <>
          {u.admin && <Tag tone="dark">Platform admin</Tag>}
          {!u.confirmed_at && <Tag tone="wait">Email not confirmed</Tag>}
        </>}
        sub={<>
          {u.email} · joined {day(u.created_at)} · last signed in {u.last_sign_in_at ? ago(u.last_sign_in_at) : 'never'}
          {about && <span className="mt-1 block text-body-sm">{about}{p?.signed_up_by ? ` · signed up by ${p.signed_up_by}` : ''}</span>}
        </>}
        actions={<IconLink href={`mailto:${u.email}`} label={`Email ${u.email}`} d={ICON.mail} />} />

      <Stats>
        <Stat label="Sessions" value={n(u.sessions_all)} sub={`${n(u.minutes_all)} minutes in all`} />
        <Stat label="Last session" value={last ? ago(last) : '—'} sub={done[0]?.title} />
        <Stat label="Notes" value={n(u.notes.received)} sub={`${n(u.notes.unread)} unread · ${n(u.notes_sent)} sent`} />
        <Stat label="Speed tests" value={n(p?.speed_tests ?? 0)} sub={u.plan ? `Own plan: ${u.plan.name ?? 'unnamed'}, ${u.plan.days} ${u.plan.days === 1 ? 'slot' : 'slots'}` : undefined} />
      </Stats>

      {p && (
        <Section title="Profile">
          <div className="mt-3 divide-y divide-outline-variant border-b border-outline-variant">
            <AgeFix id={u.id} band={p.age_band ?? null} label={p.age_band ? (AGE_LABEL[p.age_band] ?? p.age_band) : 'Not set'} consent={consent} />
          </div>
        </Section>
      )}

      <Section title="Academies">
        {!u.academies.length && !u.asking.length
          ? <Empty>In no academy.</Empty>
          : (
            <Rows>
              {u.academies.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/academies/${m.id}`} className="-mx-3 flex items-center justify-between gap-3 rounded-xl px-3 py-4 hover:bg-surface-container-low">
                    <span className="flex min-w-0 items-center gap-2"><RoleTag role={m.role} /><span className="truncate font-bold text-on-surface">{m.name}</span>{inactive.has(`${m.id}:${u.id}`) && <Tag tone="rose">Inactive</Tag>}</span>
                    <span className="shrink-0 text-body-sm text-on-surface-variant">since {day(m.joined_at)}</span>
                  </Link>
                </li>
              ))}
              {u.asking.map((m) => (
                <li key={`ask-${m.id}`}>
                  <Link href={`/admin/academies/${m.id}`} className="-mx-3 flex items-center justify-between gap-3 rounded-xl px-3 py-4 hover:bg-surface-container-low">
                    <span className="truncate font-bold text-on-surface">{m.name}</span>
                    <span className="shrink-0 text-body-sm text-on-surface-variant">
                      {m.declined ? 'turned down' : m.role === 'trainer' ? 'asked to train' : 'asked to join'} {ago(m.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </Rows>
          )}
      </Section>

      <Section title="Sessions" count={u.workouts.length}>
        {!!u.unfinished && <p className="mt-1 text-body-sm text-on-surface-variant">{n(u.unfinished)} more started or planned and not finished.</p>}
        {!u.workouts.length ? <Empty>None yet.</Empty> : (
          <Table head={<><Th>Session</Th><Th>Kind</Th><Th>For</Th><Th right>Min</Th><Th right>Touches</Th><Th>When</Th></>}>
            {u.workouts.map((w) => (
              <tr key={w.id}>
                <Td strong>{w.title}{w.feel && <span className="block text-body-sm font-normal text-on-surface-variant">felt {w.feel}</span>}</Td>
                <Td>{sourceLabel(w.source)}</Td>
                <Td className="max-w-[12rem] truncate">{w.academy !== undefined ? forWhom(w.academy, w.source) : w.status === 'completed' ? 'Done' : w.status === 'in_progress' ? 'Started' : 'Planned'}</Td>
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

/** Where a parent's or guardian's agreement stands, for a player under 13 (0043). */
async function consentLine(id: string): Promise<string> {
  const db = serviceDb();
  if (!db) return 'Agreement: can’t be read here';
  const { data, error } = await db.from('parent_consents').select('requested_at, first_asked_at, agreed_at, method').eq('user_id', id).maybeSingle();
  if (error) return 'Agreement: can’t be read just now';
  const c = data as { requested_at: string | null; first_asked_at: string; agreed_at: string | null; method: string | null } | null;
  if (!c) return 'No parent or guardian asked yet';
  if (c.agreed_at) return `A parent or guardian agreed ${day(c.agreed_at)}${c.method === 'sample' ? ' (marked by hand)' : ''}`;
  const by = day(new Date(Date.parse(c.first_asked_at) + CONSENT_DAYS * 86_400_000).toISOString());
  return `${c.requested_at ? `Parent or guardian emailed ${day(c.requested_at)}` : 'Nobody has agreed yet'}; deleted after ${by} if nobody does`;
}
