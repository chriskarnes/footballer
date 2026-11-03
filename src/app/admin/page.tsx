import { serverClient } from '@/lib/supabase/server';
import { BackLink } from '@/components/BackLink';
import { SignIn } from '@/components/SignIn';
import { BrandingAdmin } from '@/components/BrandingAdmin';
import { ROW_COLUMNS } from '@/lib/branding-server';
import { toBranding, type BrandingRow } from '@/lib/branding';

export const metadata = { robots: { index: false } };

/**
 * Brand settings. Reached from Me, and only shown there to admins — but the
 * gate is here and in every action, not in the link.
 *
 * Four ways in that are not the panel, each saying what to do next rather than
 * just "no": not configured, signed out, migration not run, not an admin.
 */
export default async function AdminPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Gate title="Not set up yet">Add your Supabase keys to .env.local first.</Gate>;
  }

  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    return (
      <Gate title="Admin sign-in">
        Sign in with an admin account to change the app&rsquo;s name, colours and logo.
        <div className="mt-5"><SignIn /></div>
      </Gate>
    );
  }

  const [{ data: row, error }, { data: admin }] = await Promise.all([
    db.from('branding').select(ROW_COLUMNS).eq('id', 1).maybeSingle(),
    db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);

  if (error) {
    return (
      <Gate title="One step left">
        The branding tables don&rsquo;t exist yet. Run{' '}
        <code className="font-semibold text-on-surface">supabase/migrations/0002_branding.sql</code>{' '}
        in the Supabase SQL editor, then reload.
      </Gate>
    );
  }

  if (!admin) {
    return (
      <Gate title="Not an admin">
        {user.email} isn&rsquo;t an admin. Someone with database access can add it in the
        Supabase SQL editor:
        <pre className="card-flat mt-4 overflow-x-auto whitespace-pre p-4 text-[12px] leading-relaxed text-on-surface">
{`insert into admins (user_id)
select id from auth.users
where email = '${user.email}';`}
        </pre>
      </Gate>
    );
  }

  return (
    <div>
      <BackLink href="/me" label="Me" />
      <p className="eyebrow mb-3">Admin</p>
      <h1 className="h-page">Brand settings</h1>
      <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-on-surface-variant">
        Unbranded is the default. Pick a kit, add your crest, and every player sees it on their next load.
      </p>
      <BrandingAdmin initial={toBranding(row as BrandingRow | null)} />
    </div>
  );
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <BackLink href="/me" label="Me" />
      <p className="eyebrow mb-3">Admin</p>
      <h1 className="h-page">{title}</h1>
      <div className="mt-3 text-[14px] leading-relaxed text-on-surface-variant">{children}</div>
    </div>
  );
}
