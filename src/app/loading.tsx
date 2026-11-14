/**
 * Shown the moment a player's page is asked for, while its data loads (Me,
 * Speed, notes, the week): a tap on the tab bar is answered at once, rather
 * than nothing for a few seconds on a weak signal and a second tap. The
 * trainer area has its own (coach/loading.tsx).
 */
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      <div className="h-40 rounded-large bg-surface-container-high" />
      <div className="mt-8 space-y-2.5">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-large bg-surface-container-high" />)}
      </div>
    </div>
  );
}
