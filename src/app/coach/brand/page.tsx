import { BrandingAdmin } from '@/components/BrandingAdmin';
import { PageHead } from '@/components/coach/PageHead';
import { staffOnly } from '@/components/coach/Gate';
import { getViewer } from '@/lib/viewer';

export const metadata = { title: 'Brand settings', robots: { index: false } };

/**
 * The academy's name, colours and logo, in the trainer area beside the rest
 * of the academy's settings. The owner's (or a platform admin's); the gate
 * is here and in every action, not in the link.
 */
export default async function BrandPage() {
  const v = await getViewer();
  if (!v.academy || !v.canBrand) {
    const gate = await staffOnly('/coach/brand');
    if ('page' in gate) return gate.page;
    return (
      <div className="lg:max-w-2xl">
        <PageHead back={{ href: '/coach/team', label: 'Academy' }} title="Owner only">Only {v.academy?.name}&rsquo;s owner can change its name, colours and logo.</PageHead>
      </div>
    );
  }
  return (
    <div className="lg:max-w-2xl">
      <PageHead back={{ href: '/coach/team', label: 'Academy' }} eyebrow={v.academy.name} title="Brand settings">
        Pick a kit, add your crest, and every player sees it on their next load.
      </PageHead>
      <BrandingAdmin initial={v.academy.branding} />
    </div>
  );
}
