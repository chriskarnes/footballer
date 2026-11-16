import Link from 'next/link';
import { adminViewer, day, loadAcademies, loadKinds, n } from '@/lib/admin-data';
import { aiMonthlyLimit } from '@/lib/ai';
import { ago } from '@/lib/notes';
import { AdminGate, Aside, Failed, PageHead, Table, Tag, Td, Th } from '@/components/admin/ui';

export const metadata = { title: 'Academies · Admin', robots: { index: false } };

/** Every academy, newest last, with its people and how they're training. */
export default async function AdminAcademies() {
  const a = await adminViewer();
  if (a.gate) return <AdminGate gate={a.gate} next="/admin/academies" />;
  const [{ data, error }, kinds] = await Promise.all([loadAcademies(), loadKinds()]);
  const rows = data ?? [];

  return (
    <div className="animate-pop">
      <PageHead title="Academies" sub={!error && `${n(rows.length)} ${rows.length === 1 ? 'academy' : 'academies'}`} />
      {error ? <Failed error={error} /> : (
        <>
          <Table head={<><Th>Academy</Th><Th>Owner</Th><Th right>Players</Th><Th right>Trained 7d</Th><Th right>Sessions 7d</Th><Th>Last session</Th></>}>
            {rows.map((r) => {
              const k = kinds.get(r.id);
              return (
                <tr key={r.id} className="relative hover:bg-surface-container-low">
                  <Td strong>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/admin/academies/${r.id}`} className="after:absolute after:inset-0 hover:underline">{r.name}</Link>
                      {k?.selfServe ? <Tag tone={k.open ? 'good' : 'plain'}>{k.open ? 'Self-serve, open' : 'Self-serve, invite only'}</Tag>
                        : r.unclaimed ? <Tag tone="wait">Not claimed</Tag>
                        : !r.set_up && <Tag tone="wait">Setting up</Tag>}
                      {r.waiting > 0 && <Tag tone="rose">{n(r.waiting)} waiting</Tag>}
                    </span>
                    <span className="mt-0.5 block text-body-sm font-normal text-on-surface-variant">
                      {r.slug}{r.city ? ` · ${r.city}` : ''} · since {day(r.created_at)}{r.library_access && ' · Forge library'}{!!r.ai_month && ` · AI ${n(r.ai_month)} of ${n(aiMonthlyLimit())}`}
                    </span>
                  </Td>
                  <Td className="max-w-[14rem] truncate">{r.owner ? (r.owner.name || r.owner.email) : '—'}</Td>
                  <Td right><span className="text-on-surface">{n(r.players)}</span>{r.trainers > 0 && <span className="block text-body-sm">{n(r.trainers)} {r.trainers === 1 ? 'trainer' : 'trainers'}</span>}</Td>
                  <Td right>{n(r.active_7d)}</Td>
                  <Td right><span className="text-on-surface">{n(r.sessions_7d)}</span><span className="block text-body-sm">{n(r.sessions_30d)} in 30d</span></Td>
                  <Td className="whitespace-nowrap">{r.last_done ? ago(r.last_done) : 'Never'}</Td>
                </tr>
              );
            })}
          </Table>
          <Aside label="How these are counted">
            A player in two academies is counted in each. Sessions count what players did for that academy or on their own, not for another one.
          </Aside>
        </>
      )}
    </div>
  );
}
