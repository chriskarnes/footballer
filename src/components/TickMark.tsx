/** A tick. `draw` draws it in, for the moment something gets done. */
export function Tick({ className, draw = false }: { className: string; draw?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor"
         strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path className={draw ? 'celebrate-tick' : undefined} d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * The round tick a drill or a session gets. Not yet done, it's a ring in the
 * academy's colour with a faint tick inside, so it reads as "a tick goes
 * here"; `here` makes it breathe. Done, it fills and the tick draws in when
 * `draw` is set. The session's drills and Train's week both use it, so the
 * two read as the same thing.
 */
export function TickMark({ on, here = false, draw = false }: { on: boolean; here?: boolean; draw?: boolean }) {
  return on ? (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
      <Tick className="h-5 w-5" draw={draw} />
    </span>
  ) : (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[2.5px] border-primary text-primary ${here ? 'tick-here' : ''}`}>
      <Tick className="h-5 w-5 opacity-25" />
    </span>
  );
}
