import Link from 'next/link';
import { adminViewer, loadOverview, n, sourceLabel, type Overview } from '@/lib/admin-data';
import { ago } from '@/lib/notes';
import { AdminGate, Failed, RoleTag, Section, Stat, Table, Td, Th } from '@/components/admin/ui';

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
      <p className="eyebrow mb-2">Platform admin</p>
      <h1 className="h-page">Overview</h1>
      {error || !o ? <Failed error={error ?? 'Couldn’t load this.'} /> : <Body o={o} />}
    </div>
  );
}

function Body({ o }: { o: Overview }) {
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Accounts" value={n(o.users)} sub={`+${n(o.users_7d)} this week · +${n(o.users_30d)} in 30 days`} href="/admin/users" />
        <Stat label="Academies" value={n(o.academies)} sub={`${n(o.trainers)} trainers · ${n(o.players)} players`} href="/admin/academies" />
        <Stat label="Trained this week" value={n(o.active_7d)} sub={`${n(o.active_30d)} in the last 30 days`} />
        <Stat label="Sessions this week" value={n(o.sessions_7d)} sub={`${n(o.minutes_7d)} min · ${n(o.sessions_30d)} in 30 days · ${n(o.sessions_all)} ever`} />
      </div>

      {(o.requests_open > 0 || o.join_waiting > 0 || o.no_academy > 0) && (
        <ul className="mt-4 flex flex-wrap gap-2 text-body-sm">
          {o.requests_open > 0 && <li><Link href="/admin/requests" className="chip">{n(o.requests_open)} academy {o.requests_open === 1 ? 'request' : 'requests'} open</Link></li>}
          {o.join_waiting > 0 && <li><span className="chip">{n(o.join_waiting)} waiting to be let into an academy</span></li>}
          {o.no_academy > 0 && <li><Link href="/admin/users?in=none" className="chip">{n(o.no_academy)} {o.no_academy === 1 ? 'account' : 'accounts'} in no academy</Link></li>}
        </ul>
      )}

      <Section title="Last 12 weeks">
        <div className="card mt-4 grid gap-6 p-5 lg:grid-cols-3">
          <Bars label="Sessions finished" weeks={o.weeks} k="sessions" />
          <Bars label="People who trained" weeks={o.weeks} k="active" />
          <Bars label="New accounts" weeks={o.weeks} k="signups" />
        </div>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          Weeks run Monday to Sunday (UTC); the last bar is this week so far.
          AI week builds in the last 30 days: {n(o.ai_30d.calls)}{o.ai_30d.failed ? ` (${n(o.ai_30d.failed)} failed)` : ''}, {n(o.ai_30d.tokens)} tokens.
        </p>
      </Section>

      <div className="grid gap-x-8 lg:grid-cols-[3fr_2fr]">
        <Section title="Latest sessions">
          {!o.recent.length ? <p className="mt-3 text-body text-on-surface-variant">No sessions finished yet.</p> : (
            <Table head={<><Th>Who</Th><Th>Session</Th><Th>Academy</Th><Th right>Min</Th><Th>When</Th></>}>
              {o.recent.map((w) => (
                <tr key={w.id} className="hover:bg-surface-container-low">
                  <Td strong><Link href={`/admin/users/${w.user_id}`} className="hover:underline">{w.name || w.email}</Link></Td>
                  <Td><span className="text-on-surface">{w.title}</span><span className="block text-body-sm">{sourceLabel(w.source)}{w.feel ? ` · felt ${w.feel}` : ''}</span></Td>
                  <Td className="max-w-[12rem] truncate">{w.academies ?? '—'}</Td>
                  <Td right>{w.minutes != null ? Math.round(w.minutes) : '—'}</Td>
                  <Td className="whitespace-nowrap">{ago(w.at)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="New accounts" action={<Link href="/admin/users" className="text-body-sm font-semibold underline underline-offset-4">Everyone</Link>}>
          <ul className="card mt-4 divide-y divide-outline-variant">
            {o.signups.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="block px-4 py-3 hover:bg-surface-container-low">
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
          </ul>
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
