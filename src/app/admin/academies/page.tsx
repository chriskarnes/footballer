import Link from 'next/link';
import { adminViewer, day, loadAcademies, n } from '@/lib/admin-data';
import { ago } from '@/lib/notes';
import { AdminGate, Failed, Table, Td, Th } from '@/components/admin/ui';

export const metadata = { title: 'Academies · Admin', robots: { index: false } };

/** Every academy, newest last, with its people and how they're training. */
export default async function AdminAcademies() {
  const a = await adminViewer();
  if (a.gate) return <AdminGate gate={a.gate} next="/admin/academies" />;
  const { data, error } = await loadAcademies();
  const rows = data ?? [];

  return (
    <div className="animate-pop">
      <p className="eyebrow mb-2">Platform admin</p>
      <h1 className="h-page">Academies</h1>
      {error ? <Failed error={error} /> : (
        <>
          <p className="mt-2 text-body text-on-surface-variant">
            {n(rows.length)} {rows.length === 1 ? 'academy' : 'academies'}. A player in two academies is counted in each.
            Sessions count what players did for that academy or on their own, not for another one.
          </p>
          <Table head={<><Th>Academy</Th><Th>Owner</Th><Th right>Trainers</Th><Th right>Players</Th><Th right>Trained 7d</Th>
                         <Th right>Sessions 7d</Th><Th right>30d</Th><Th>Last session</Th><Th>Started</Th></>}>
            {rows.map((r) => (
              <tr key={r.id} className="relative hover:bg-surface-container-low">
                <Td strong>
                  <Link href={`/admin/academies/${r.id}`} className="after:absolute after:inset-0 hover:underline">{r.name}</Link>
                  <span className="block text-body-sm font-normal text-on-surface-variant">
                    {r.slug}{r.city ? ` · ${r.city}` : ''}
                    {!r.set_up && ' · setting up'}{r.library_access && ' · Forge library'}{r.waiting > 0 && ` · ${r.waiting} waiting`}
                  </span>
                </Td>
                <Td className="max-w-[14rem] truncate">{r.owner ? (r.owner.name || r.owner.email) : '—'}</Td>
                <Td right>{n(r.trainers)}</Td>
                <Td right>{n(r.players)}</Td>
                <Td right>{n(r.active_7d)}</Td>
                <Td right>{n(r.sessions_7d)}</Td>
                <Td right>{n(r.sessions_30d)}</Td>
                <Td className="whitespace-nowrap">{r.last_done ? ago(r.last_done) : 'Never'}</Td>
                <Td className="whitespace-nowrap">{day(r.created_at)}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}
