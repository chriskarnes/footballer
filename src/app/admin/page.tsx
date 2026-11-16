import Link from 'next/link';
import { adminViewer, aiLine, forWhom, loadOverview, n, sourceLabel, type Overview } from '@/lib/admin-data';
import { ago } from '@/lib/notes';
import { AdminGate, Aside, Empty, Failed, PageHead, RoleTag, Rows, Section, Stat, Stats, Table, Td, Th } from '@/components/admin/ui';

export const metadata = { title: 'Admin', robots: { index: false } };

/**
 * The platform at a glance: how many, how active, what's happening now.
 * (Brand settings, which used to be here, live at /coach/brand.)
 */
export default async function AdminOverview() {
  const a = await adminViewer();
  if (a.gate) return <AdminGate gate={a.gate} next="/admin" />;
  const { data: o, error } = await loadOverview();

  return (
    <div className="animate-pop">
      <PageHead title="Overview" />
      {error || !o ? <Failed error={error ?? 'Couldn’t load this.'} /> : <Body o={o} />}
    </div>
  );
}

function Body({ o }: { o: Overview }) {
  return (
    <>
      {(o.requests_open > 0 || o.join_waiting > 0 || o.no_academy > 0) && (
        <ul className="mt-5 flex flex-wrap gap-2 text-body-sm">
          {o.requests_open > 0 && <li><Link href="/admin/requests" className="chip">{n(o.requests_open)} academy {o.requests_open === 1 ? 'request' : 'requests'} open</Link></li>}
          {o.join_waiting > 0 && <li><span className="chip">{n(o.join_waiting)} waiting to be let into an academy</span></li>}
          {o.no_academy > 0 && <li><Link href="/admin/users?in=none" className="chip">{n(o.no_academy)} {o.no_academy === 1 ? 'account' : 'accounts'} in no academy</Link></li>}
        </ul>
      )}

      <Stats>
        <Stat label="Accounts" value={n(o.users)} sub={`+${n(o.users_7d)} in 7 days · +${n(o.users_30d)} in 30 days`} href="/admin/users" />
        <Stat label="Academies" value={n(o.academies)} sub={`${n(o.trainers)} trainers · ${n(o.players)} players`} href="/admin/academies" />
        <Stat label="Trained, last 7 days" value={n(o.active_7d)} sub={`${n(o.active_30d)} in the last 30 days`} />
        <Stat label="Sessions, last 7 days" value={n(o.sessions_7d)} sub={`${n(o.minutes_7d)} min · ${n(o.sessions_30d)} in 30 days · ${n(o.sessions_all)} ever`} />
      </Stats>

      <Section title="Last 12 weeks">
        <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-3">
          <Bars label="Sessions finished" weeks={o.weeks} k="sessions" />
          <Bars label="People who trained" weeks={o.weeks} k="active" />
          <Bars label="New accounts" weeks={o.weeks} k="signups" />
        </div>
        <p className="mt-6 text-body-sm text-on-surface-variant">AI in the last 30 days: {aiLine(o.ai_30d)}.</p>
        <Aside label="How the weeks are counted">Weeks run Monday to Sunday (UTC). The last bar is this week so far.</Aside>
      </Section>

      <div className="grid gap-x-14 lg:grid-cols-[3fr_2fr]">
        <Section title="Latest sessions">
          {!o.recent.length ? <Empty>No sessions finished yet.</Empty> : (
            <Table head={<><Th>Who</Th><Th>Session</Th><Th>Academy</Th><Th right>Min</Th><Th>When</Th></>}>
              {o.recent.map((w) => (
                <tr key={w.id}>
                  <Td strong><Link href={`/admin/users/${w.user_id}`} className="hover:underline">{w.name || w.email}</Link></Td>
                  <Td><span className="text-on-surface">{w.title}</span><span className="block text-body-sm">{sourceLabel(w.source)}{w.feel ? ` · felt ${w.feel}` : ''}</span></Td>
                  <Td className="max-w-[12rem] truncate">{w.academy !== undefined ? forWhom(w.academy, w.source) : (w.academies ?? 'Own')}</Td>
                  <Td right>{w.minutes != null ? Math.round(w.minutes) : '—'}</Td>
                  <Td className="whitespace-nowrap">{ago(w.at)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="New accounts" action={<Link href="/admin/users" className="text-body-sm font-semibold underline underline-offset-4">Everyone</Link>}>
          <Rows>
            {o.signups.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="-mx-3 block rounded-xl px-3 py-4 hover:bg-surface-container-low">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-bold text-on-surface">{u.name || u.email}</span>
                    <span className="shrink-0 text-body-sm text-on-surface-variant">{ago(u.created_at)}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-body-sm text-on-surface-variant">
                    {u.name && <span className="truncate">{u.email}</span>}
                    {(u.academies ?? []).map((m) => <span key={m.slug} className="inline-flex items-center gap-1"><RoleTag role={m.role} />{m.name}</span>)}
                    {!u.academies?.length && <span>No academy</span>}
                    {!u.last_sign_in_at && <span>· never signed in</span>}
                  </span>
                </Link>
              </li>
            ))}
          </Rows>
        </Section>
      </div>
    </>
  );
}

/** Twelve weeks as bars, with the numbers there for a screen reader too. */
function Bars({ label, weeks, k }: { label: string; weeks: Overview['weeks']; k: 'sessions' | 'active' | 'signups' }) {
  const max = Math.max(1, ...weeks.map((w) => w[k]));
  const now = weeks.at(-1)?.[k] ?? 0;
  const fmt = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d));
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between">
        <span className="text-body font-semibold text-on-surface">{label}</span>
        <span className="text-body-sm text-on-surface-variant tabular-nums">{n(now)} this week</span>
      </figcaption>
      <ol className="mt-3 flex h-24 items-end gap-1" aria-label={label}>
        {weeks.map((w, i) => (
          <li key={w.week} className="flex h-full flex-1 items-end" title={`Week of ${fmt(w.week)}: ${n(w[k])}`}>
            <span className="sr-only">Week of {fmt(w.week)}: {n(w[k])}</span>
            <span aria-hidden="true"
                  className={`block w-full rounded-t-sm ${i === weeks.length - 1 ? 'bg-primary' : 'bg-outline'}`}
                  style={{ height: `${Math.max(w[k] ? 4 : 1, (w[k] / max) * 100)}%` }} />
          </li>
        ))}
      </ol>
      <p className="mt-1 flex justify-between text-caption text-on-surface-variant" aria-hidden="true">
        <span>{weeks[0] && fmt(weeks[0].week)}</span><span>This week</span>
      </p>
    </figure>
  );
}
