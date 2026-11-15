import { CONTACT_EMAIL, LEGAL_UPDATED, POSTAL_ADDRESS } from '@/lib/legal';

/** A plain document page on the main site: a title, a date, and sections. */
export function LegalPage({ title, intro, children }: { title: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[44rem] pb-8 pt-28 sm:pt-36">
      <h1 className="font-brand text-[34px] font-extrabold leading-[1.06] tracking-brand-snug text-site-ink sm:text-[44px]">{title}</h1>
      <p className="mt-3 text-[14px] text-on-surface-variant">Last updated {LEGAL_UPDATED}</p>
      <p className="mt-6 text-[17px] leading-relaxed text-on-surface">{intro}</p>
      {children}
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-brand text-[22px] font-extrabold leading-tight text-site-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-on-surface-variant [&_b]:text-on-surface [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

/** How to reach us: by email when an address is set, and always by post. */
export function Contact({ about }: { about: string }) {
  return CONTACT_EMAIL
    ? <>Email <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-on-surface underline underline-offset-4">{CONTACT_EMAIL}</a> {about}.</>
    : <>Write to us at the address below {about}.</>;
}

/** Our postal address, as a block. */
export function PostalAddress() {
  return (
    <address className="not-italic text-on-surface">
      {POSTAL_ADDRESS.map((line) => <span key={line} className="block">{line}</span>)}
    </address>
  );
}
