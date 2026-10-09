import { getSessions } from '@/lib/library';
import { serverClient } from '@/lib/supabase/server';
import { TodayCard } from './TodayCard';

/**
 * "Today on your plan", for Train. Train is the front door, so it's where a
 * player who follows a week should see what that week says to do today —
 * rather than having to remember there's a Plan tab.
 *
 * A server component under its own Suspense on the page: signed out, or with no
 * plan, it renders nothing, and the rest of Train never waits on it.
 */
export async function TodayOnPlan() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const db = await serverClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return null;

    const { data: plan } = await db.from('plans').select('id,name')
      .eq('user_id', auth.user.id).eq('active', true).limit(1).maybeSingle();
    if (!plan) return null;

    const since = new Date(Date.now() - 8 * 86400000).toISOString();
    const [{ data: days }, { data: done }, sessions] = await Promise.all([
      db.from('plan_days').select('weekday,slot,kind,session_id').eq('plan_id', plan.id),
      db.from('workouts').select('source_ref,completed_at')
        .eq('status', 'completed').eq('source', 'library').gte('completed_at', since),
      getSessions(),
    ]);

    // Only the sessions this week uses cross to the client.
    const ids = new Set((days ?? []).map((d) => d.session_id).filter(Boolean));
    const used = sessions.filter((s) => ids.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, total_minutes: s.total_minutes }));

    return <TodayCard planName={plan.name} days={days ?? []} completions={done ?? []} sessions={used} />;
  } catch {
    return null;
  }
}
