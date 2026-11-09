import { BackLink } from '@/components/BackLink';
import { SignIn } from '@/components/SignIn';
import { BrandingAdmin } from '@/components/BrandingAdmin';
import { getViewer } from '@/lib/viewer';

export const metadata = { robots: { index: false } };

/**
 * Brand settings for the academy this subdomain belongs to. Reached from the
 * trainer area and Me, and only shown there to the owner — but the gate is
 * here and in every action, not in the link.
 */
export default async function AdminPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Gate title="Not set up yet">Add your Supabase keys to .env.local first.</Gate>;
  }

  const v = await getViewer();
  if (!v.academy) {
    return (
      <Gate title="No academy here">
        Branding belongs to an academy. Open its own address, like <b>yourname.train.futbol/admin</b>.
      </Gate>
    );
  }
  if (!v.user) {
    return (
      <Gate title="Sign in">
        Sign in as {v.academy.name}&rsquo;s owner to change its name, colours and logo.
        <div className="mt-5"><SignIn next="/admin" /></div>
      </Gate>
    );
  }
  if (!v.canBrand) {
    return <Gate title="Owner only">Only {v.academy.name}&rsquo;s owner can change its brand.</Gate>;
  }

  return (
    <div>
      <BackLink href="/coach/team" label="Team" />
      <p className="eyebrow mb-3">{v.academy.name}</p>
      <h1 className="h-page">Brand settings</h1>
      <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-on-surface-variant">
        Pick a kit, add your crest, and every player sees it on their next load.
      </p>
      <BrandingAdmin initial={v.academy.branding} />
    </div>
  );
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <BackLink href="/me" label="Me" />
      <p className="eyebrow mb-3">Brand settings</p>
      <h1 className="h-page">{title}</h1>
      <div className="mt-3 text-[14px] leading-relaxed text-on-surface-variant">{children}</div>
    </div>
  );
}
