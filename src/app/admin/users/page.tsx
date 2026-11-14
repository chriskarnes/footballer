import Link from 'next/link';
import { adminViewer, day, loadUsers, n, type UserRow } from '@/lib/admin-data';
import { ago } from '@/lib/notes';
import { AdminGate, Failed, RoleTag, Table, Td, Th } from '@/components/admin/ui';
import { CheckIcon } from '@/components/Chip';

export const metadata = { title: 'People · Admin', robots: { index: false } };

const FILTERS = [
  { id: 'all', label: 'Everyone' },
  { id: 'players', label: 'Players' },
  { id: 'staff', label: 'Trainers' },
  { id: 'none', label: 'No academy' },
  { id: 'quiet', label: 'Not trained in 30 days' },
] as const;
type Filter = typeof FILTERS[number]['id'];

const keep: Record<Filter, (u: UserRow) => boolean> = {
  all: () => true,
  players: (u) => !!u.academies?.some((m) => m.role === 'player'),
  staff: (u) => !!u.academies?.some((m) => m.role !== 'player'),
  none: (u) => !u.academies?.length,
  quiet: (u) => !!u.academies?.some((m) => m.role === 'player') && u.sessions_30d === 0,
};

/** Every account, newest first. A plain form, so it works before scripts load. */
export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; in?: string }> }) {
  const a = await adminViewer();
  if (a.gate) return <AdminGate gate={a.gate} next="/admin/users" />;
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase().slice(0, 80);
  const filter: Filter = FILTERS.some((f) => f.id === sp.in) ? sp.in as Filter : 'all';
  const { data, error } = await loadUsers();
  const all = data ?? [];
  const rows = all.filter(keep[filter]).filter((u) => !q
    || u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q)
    || !!u.academies?.some((m) => m.name.toLowerCase().includes(q) || m.slug.includes(q)));
  const href = (id: Filter) => `/admin/users?${new URLSearchParams({ ...(id !== 'all' && { in: id }), ...(q && { q }) })}`;

  return (
    <div className="animate-pop">
      <p className="eyebrow mb-2">Platform admin</p>
      <h1 className="h-page">People</h1>
      {error ? <Failed error={error} /> : (
        <>
          <form action="/admin/users" className="mt-5 flex max-w-xl gap-2" role="search">
            {filter !== 'all' && <input type="hidden" name="in" value={filter} />}
            <label className="text-field flex-1">
              <span className="sr-only">Search by name, email or academy</span>
              <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Name, email or academy" />
            </label>
            <button type="submit" className="btn-ghost pressable">Search</button>
          </form>
          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Show">
            {FILTERS.map((f) => (
              <Link key={f.id} href={href(f.id)} aria-current={f.id === filter ? 'page' : undefined}
                    className={`chip ${f.id === filter ? 'chip-on' : ''}`}>
                {f.id === filter && <CheckIcon />}{f.label} <span className="tabular-nums opacity-70">{n(all.filter(keep[f.id]).length)}</span>
              </Link>
            ))}
          </nav>

          {!rows.length ? <p className="mt-6 text-body text-on-surface-variant">No one matches.</p> : (
            <Table head={<><Th>Name</Th><Th>Academies</Th><Th right>Sessions 30d</Th><Th right>Ever</Th><Th>Last session</Th><Th>Last sign-in</Th><Th>Joined</Th></>}>
              {rows.map((u) => (
                <tr key={u.id} className="relative hover:bg-surface-container-low">
                  <Td strong>
                    <Link href={`/admin/users/${u.id}`} className="after:absolute after:inset-0 hover:underline">{u.name || u.email}</Link>
                    {u.admin && <span className="ml-2 text-caption font-semibold text-on-surface-variant">ADMIN</span>}
                    {u.name && <span className="block text-body-sm font-normal text-on-surface-variant">{u.email}</span>}
                  </Td>
                  <Td>
                    {u.academies?.length
                      ? <span className="flex flex-col gap-1">{u.academies.map((m) => <span key={m.id} className="inline-flex items-center gap-1.5 whitespace-nowrap"><RoleTag role={m.role} />{m.name}</span>)}</span>
                      : 'None'}
                  </Td>
                  <Td right>{n(u.sessions_30d)}</Td>
                  <Td right>{n(u.sessions_all)}</Td>
                  <Td className="whitespace-nowrap">{u.last_done ? ago(u.last_done) : 'Never'}</Td>
                  <Td className="whitespace-nowrap">{u.last_sign_in_at ? ago(u.last_sign_in_at) : 'Never'}</Td>
                  <Td className="whitespace-nowrap">{day(u.created_at)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </div>
  );
}
