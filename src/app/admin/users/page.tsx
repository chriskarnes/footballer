import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminViewer, day, loadInactive, loadUsers, n, USER_FILTERS, USERS_PER_PAGE, type UserFilter } from '@/lib/admin-data';
import { ago } from '@/lib/notes';
import { AdminGate, Empty, Failed, PageHead, Pager, RoleTag, Table, Tag, Td, Th } from '@/components/admin/ui';
import { CheckIcon } from '@/components/Chip';

export const metadata = { title: 'People · Admin', robots: { index: false } };

const FILTERS: { id: UserFilter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'players', label: 'Players' },
  { id: 'staff', label: 'Trainers' },
  { id: 'none', label: 'No academy' },
  { id: 'quiet', label: 'Not trained in 30 days' },
];

/** Every account, newest first, a page at a time. A plain form, so it works before scripts load. */
export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; in?: string; page?: string }> }) {
  const a = await adminViewer();
  if (a.gate) return <AdminGate gate={a.gate} next="/admin/users" />;
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase().slice(0, 80);
  const filter: UserFilter = (USER_FILTERS as readonly string[]).includes(sp.in ?? '') ? sp.in as UserFilter : 'all';
  const page = Math.max(0, Math.min(1000, Math.floor(Number(sp.page) || 0)));
  const { data, error } = await loadUsers(q, filter, page);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  // Past the last page (an old link, or a search that's since narrowed): the last one.
  if (!error && !rows.length && total > 0 && page > 0) {
    const last = Math.max(0, Math.ceil(total / USERS_PER_PAGE) - 1);
    const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(filter !== 'all' ? { in: filter } : {}), ...(last ? { page: String(last) } : {}) }).toString();
    redirect(`/admin/users${qs ? `?${qs}` : ''}`);
  }
  const inactive = await loadInactive({ users: rows.map((u) => u.id) });
  const href = (id: UserFilter, p = 0) =>
    `/admin/users?${new URLSearchParams({ ...(id !== 'all' && { in: id }), ...(q && { q }), ...(p > 0 && { page: String(p) }) })}`;

  return (
    <div className="animate-pop">
      <PageHead title="People" />
      {error ? <Failed error={error} /> : (
        <>
          <form action="/admin/users" className="relative mt-8 max-w-md" role="search">
            {filter !== 'all' && <input type="hidden" name="in" value={filter} />}
            <label className="text-field">
              <span className="sr-only">Search by name, email or academy</span>
              <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Search by name, email or academy" className="!rounded-full !pl-5 !pr-14" />
            </label>
            <button type="submit" aria-label="Search" title="Search" className="icon-btn absolute right-2 top-2">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            </button>
          </form>
          <nav className="mt-5 flex flex-wrap gap-2" aria-label="Show">
            {FILTERS.map((f) => (
              <Link key={f.id} href={href(f.id)} aria-current={f.id === filter ? 'page' : undefined}
                    className={`chip ${f.id === filter ? 'chip-on' : ''}`}>
                {f.id === filter && <CheckIcon />}{f.label} <span className="tabular-nums opacity-70">{n(data?.counts[f.id])}</span>
              </Link>
            ))}
          </nav>

          {!rows.length ? <Empty>No one matches.</Empty> : (
            <div className="mt-4"><Table head={<><Th>Name</Th><Th>Academies</Th><Th right>Sessions 30d</Th><Th>Last session</Th><Th>Last sign-in</Th><Th>Joined</Th></>}>
              {rows.map((u) => (
                <tr key={u.id} className="relative hover:bg-surface-container-low">
                  <Td strong className="max-w-[15rem]">
                    <Link href={`/admin/users/${u.id}`} className="after:absolute after:inset-0 hover:underline">{u.name || u.email}</Link>
                    {u.admin && <span className="ml-2 align-middle"><Tag tone="dark">Admin</Tag></span>}
                    {u.name && <span className="block truncate text-body-sm font-normal text-on-surface-variant" title={u.email}>{u.email}</span>}
                  </Td>
                  <Td>
                    {u.academies?.length
                      ? <span className="flex flex-col gap-1">{u.academies.map((m) => <span key={m.id} className="inline-flex items-center gap-1.5 whitespace-nowrap"><RoleTag role={m.role} />{m.name}{inactive.has(`${m.id}:${u.id}`) && <Tag tone="rose">Inactive</Tag>}</span>)}</span>
                      : 'None'}
                  </Td>
                  <Td right><span className="text-on-surface">{n(u.sessions_30d)}</span><span className="block text-body-sm">{n(u.sessions_all)} ever</span></Td>
                  <Td className="whitespace-nowrap">{u.last_done ? ago(u.last_done) : 'Never'}</Td>
                  <Td className="whitespace-nowrap">{u.last_sign_in_at ? ago(u.last_sign_in_at) : 'Never'}</Td>
                  <Td className="whitespace-nowrap">{day(u.created_at)}</Td>
                </tr>
              ))}
            </Table></div>
          )}
          <Pager page={page} per={USERS_PER_PAGE} total={total} href={(p) => href(filter, p)} label="Pages of people" />
        </>
      )}
    </div>
  );
}
