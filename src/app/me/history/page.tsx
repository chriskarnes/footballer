import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { BackLink } from '@/components/BackLink';
import { WorkoutList } from '@/components/WorkoutList';
import { finishedRows, readWorkouts } from '@/lib/workout-rows';

/** Every finished session. Me shows the latest five; this is the rest. */
export default async function HistoryPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect('/me');
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/me');

  const rows = finishedRows(await readWorkouts(db));
  return (
    <div>
      <BackLink href="/me" label="Me" />
      <h1 className="h-hero">History</h1>
      <p className="mt-3 text-[16px] font-semibold text-on-surface-variant">
        {rows.length} session{rows.length === 1 ? '' : 's'} done
      </p>
      <div className="mt-7"><WorkoutList rows={rows} kind="history" /></div>
    </div>
  );
}
