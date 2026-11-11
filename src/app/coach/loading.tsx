/**
 * Shown the moment a trainer page is asked for, while its data loads: the
 * shape of a heading and a list, so a click is answered straight away.
 */
export default function CoachLoading() {
  return (
    <div className="mt-4 animate-pulse lg:mt-0" role="status" aria-label="Loading">
      <div className="h-8 w-48 rounded-full bg-surface-container-high" />
      <div className="mt-8 space-y-2.5">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-surface-container-high" />)}
      </div>
    </div>
  );
}
