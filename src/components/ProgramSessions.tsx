import Link from 'next/link';
import { formatMinutes } from '@/lib/program-copy';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';

export type CardSession = {
  id: string; label: string | null; title: string; minutes: number; touches: number;
  focus: FocusArea[];
  /** Times finished, and times the program asks for. Null signed out. */
  done: number | null; target: number;
};
export type Block = { n: number; weeks: string; weekCount: number; sessions: CardSession[] };
type Featured = 'next' | 'start' | null;

/**
 * Three tiles, one per block, so the shape of the program is visible before
 * any session is: twelve weeks is three steps, and you are on this one.
 */
export function BlockStrip({ blocks, current, signedIn }: { blocks: Block[]; current: number; signedIn: boolean }) {
  return (
    <nav aria-label="Program blocks" className="mt-7 grid gap-2" style={{ gridTemplateColumns: `repeat(${blocks.length}, minmax(0, 1fr))` }}>
      {blocks.map((b) => {
        const pct = blockProgress(b);
        const on = b.n === current;
        return (
          <a key={b.n} href={`#block-${b.n}`} className={`tile pressable px-3 py-3 ${on ? 'tile-on' : ''}`}>
            <span className="eyebrow block">Block {b.n}</span>
            <span className="mt-0.5 block font-brand text-body font-bold tracking-brand-snug text-on-surface">{b.weeks}</span>
            {signedIn && (
              <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-surface-container-highest">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

const blockProgress = (b: Block) => {
  const want = b.sessions.length * b.weekCount;
  const got = b.sessions.reduce((a, s) => a + Math.min(s.done ?? 0, s.target), 0);
  return want ? Math.round((got / want) * 100) : 0;
};

/**
 * One block as a stop on a line. The heading says the thing the old list
 * never did — these sessions repeat every week of the block — and what the
 * block works on, from its sessions' focus areas.
 */
export function BlockSection({ block, last, current, nextId, featured }: {
  block: Block; last: boolean; current: boolean; nextId: string | null; featured: Featured;
}) {
  const complete = blockProgress(block) === 100;
  return (
    <section id={`block-${block.n}`} className="relative scroll-mt-6 pl-12">
      {!last && <span aria-hidden="true" className="absolute bottom-[-36px] left-[15px] top-9 w-[2px] bg-outline-variant" />}
      <span aria-hidden="true"
            className={`absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full font-brand text-body font-extrabold
                        ${current ? 'border border-brand-edge bg-surface-brand text-on-surface-brand'
                          : complete ? 'bg-primary text-on-primary'
                          : 'border-2 border-outline-variant bg-surface text-on-surface-variant'}`}>
        {complete ? <Check className="h-4 w-4" /> : block.n}
      </span>

      <p className="text-body font-bold text-on-surface-variant">Block {block.n}{current && ' · You’re here'}</p>
      <h2 className="mt-1 font-brand text-display-sm font-extrabold leading-tight tracking-tight">{block.weeks}</h2>
      <p className="mt-1.5 text-body leading-snug text-on-surface-variant">
        {block.weekCount > 1
          ? `Do these every week for ${block.weekCount} weeks.`
          : `${block.sessions.length} sessions this week.`}
      </p>

      <ol className="stagger mt-4 space-y-3">
        {block.sessions.map((s) => (
          <li key={s.id}><SessionCard s={s} featured={s.id === nextId ? featured : null} unit="week" /></li>
        ))}
      </ol>
    </section>
  );
}

/** Programs without blocks: the same cards, numbered, no timeline. */
export function SessionList({ sessions, nextId, featured }: { sessions: CardSession[]; nextId: string | null; featured: Featured }) {
  return (
    <ol className="stagger mt-10 space-y-3">
      {sessions.map((s) => (
        <li key={s.id}><SessionCard s={s} featured={s.id === nextId ? featured : null} unit="time" /></li>
      ))}
    </ol>
  );
}

/**
 * A session, read top to bottom: when (Day 1) and how long, what it is, what
 * it trains, and how far you are with it. The next one to do is drawn as the
 * brand block with a Start on it — the one card on the page that asks for
 * something — and finished ones step back.
 */
function SessionCard({ s, featured, unit }: { s: CardSession; featured: Featured; unit: 'week' | 'time' }) {
  const finished = s.done !== null && s.done >= s.target;
  const hero = !!featured;
  return (
    <Link href={`/session/${s.id}`}
          className={hero
            ? 'pressable block brand-card p-5'
            : `card pressable block p-5 ${finished ? 'opacity-70' : ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-body font-bold ${hero ? 'text-brand-accent' : 'text-on-surface-variant'}`}>
          {featured === 'next' ? 'Up next' : featured === 'start' ? 'Start here' : null}
          {featured && s.label ? ' · ' : null}
          {s.label}
        </span>
        <span className={`shrink-0 font-brand text-body font-bold tracking-brand-snug ${hero ? '' : 'text-on-surface'}`}>
          {formatMinutes(s.minutes)}
        </span>
      </div>

      <h3 className={`mt-1.5 font-brand text-title-lg font-bold leading-snug tracking-brand-snug ${hero ? 'text-on-surface-brand' : 'text-on-surface'}`}>
        {s.title}
      </h3>

      {(s.done !== null || hero) && (
        <div className={`mt-4 flex items-center justify-between gap-3 border-t pt-3.5 ${hero ? 'border-brand-track' : 'border-outline-variant'}`}>
          {s.done !== null ? <Progress s={s} hero={hero} unit={unit} /> : <span />}
          {hero && (
            <span className="btn-primary btn-on-brand btn-sm shrink-0">Start</span>
          )}
        </div>
      )}
    </Link>
  );
}

/** One pip per week of the block: how many of them this session is done for. */
function Progress({ s, hero, unit }: { s: CardSession; hero: boolean; unit: 'week' | 'time' }) {
  const done = Math.min(s.done ?? 0, s.target);
  const muted = hero ? 'text-on-surface-brand-variant' : 'text-on-surface-variant';
  if (s.target === 1) {
    return done
      ? <span className={`flex items-center gap-1.5 text-body-sm font-semibold ${muted}`}><Check className="h-4 w-4" /> Done</span>
      : <span className={`text-body-sm font-medium ${muted}`}>Not done yet</span>;
  }
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: s.target }, (_, i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i < done
            ? (hero ? 'bg-brand-accent' : 'bg-primary')
            : (hero ? 'bg-brand-track' : 'bg-surface-container-highest')}`} />
        ))}
      </span>
      <span className={`text-body-sm font-medium ${muted}`}>
        {done >= s.target ? 'All weeks done' : `${done} of ${s.target} ${unit}s`}
      </span>
    </span>
  );
}

function Check({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor"
         strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  );
}
