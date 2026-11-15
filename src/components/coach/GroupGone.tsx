import Link from 'next/link';

/**
 * A ?group= link to a group that's finished, or gone: the filter only knows
 * running groups, so the page shows everyone. Said, so a trainer following
 * an old link doesn't read the academy's numbers as that group's.
 */
export function GroupGone({ group, groups }: { group?: string; groups: { id: string; name: string; archived?: boolean }[] }) {
  if (!group) return null;
  const g = groups.find((x) => x.id === group);
  if (g && !g.archived) return null;
  return (
    <p role="status" className="card-flat mt-4 px-4 py-3 text-body text-on-surface-variant">
      {g ? <>
        <b className="font-semibold text-on-surface">{g.name}</b> has finished, so this shows everyone.{' '}
        <Link href={`/coach/groups/${g.id}`} className="font-semibold text-on-surface underline underline-offset-4">See {g.name}</Link>
      </> : <>That group isn&rsquo;t here any more, so this shows everyone.</>}
    </p>
  );
}
