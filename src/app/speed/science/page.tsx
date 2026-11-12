import { BackLink } from '@/components/BackLink';
import { CAVEATS, GROWTH_RULES, LOAD_RULES, RED_FLAGS, SOURCES } from '@/lib/speed';

/**
 * Why the program is shaped the way it is, with the papers. Here rather than
 * in a README because a parent or a club coach is the reader, and they are
 * holding a phone.
 */
export default function SciencePage() {
  return (
    <div className="animate-pop">
      <BackLink href="/speed" label="Speed" />
      <h1 className="h-page">The science</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-on-surface-variant">
        Each part of the program maps to peer-reviewed work. The components are individually
        supported; the package is conventional academy practice, and the 4-week tests are how you
        confirm it is working for your athletes.
      </p>

      <section className="mt-8">
        <h2 className="h-sec mb-3">What the research says</h2>
        <div className="stagger space-y-2.5">
          {SOURCES.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener" className="card pressable block p-4">
              <div className="h-card">{s.element}</div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-on-surface-variant">{s.finding}</p>
              <div className="mt-2.5 text-[14px] font-bold text-primary">{s.cite} ↗</div>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="h-sec mb-3">Where the evidence is thin</h2>
        <ul className="card-flat divide-y divide-outline-variant">
          {CAVEATS.map((c) => (
            <li key={c} className="p-4 text-[15px] leading-relaxed text-on-surface-variant">{c}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="h-sec mb-3">Load rules</h2>
        <ol className="card-flat divide-y divide-outline-variant">
          {LOAD_RULES.map((r, i) => (
            <li key={r} className="flex gap-4 p-4 text-[15px] leading-relaxed">
              <span className="font-brand text-[14px] font-bold text-on-surface-variant">{String(i + 1).padStart(2, '0')}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="h-sec mb-3">Growth spurt rules</h2>
        <p className="mb-3 text-[15px] leading-relaxed text-on-surface-variant">
          Height goes on the card every test day. More than 2.5 cm in a block means the athlete is
          near peak height velocity. For the next 2–3 blocks:
        </p>
        <ul className="card-flat divide-y divide-outline-variant">
          {GROWTH_RULES.map((r) => (
            <li key={r} className="p-4 text-[15px] leading-relaxed">{r}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="h-sec mb-3">Stop and refer</h2>
        <div className="card-flat divide-y divide-outline-variant">
          {RED_FLAGS.map((f) => (
            <div key={f.sign} className="p-4">
              <div className="text-[15px] font-bold">{f.sign}</div>
              <div className="mt-1 text-[14px] leading-relaxed text-on-surface-variant">{f.action}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-on-surface-variant">
          This is a coaching plan, not medical advice. An athlete with an injury history or a medical
          condition should be cleared by a doctor or physiotherapist before starting, and any pain
          that persists should be assessed by one. Sources accessed 22 Oct 2026.
        </p>
      </section>
    </div>
  );
}
