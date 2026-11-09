/** Shown while the database is a migration behind the code. */
export function Pending() {
  return (
    <p className="card-flat mt-6 px-4 py-3 text-[13.5px] text-on-surface-variant">
      Programs and groups need the latest database update (migration 0007).
    </p>
  );
}
