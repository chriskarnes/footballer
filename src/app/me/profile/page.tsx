import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { BackLink } from '@/components/BackLink';
import { ProfileSetup, type ProfileValues } from '@/components/ProfileSetup';

/**
 * The profile, reachable at any time.
 *
 * The setup questions used to appear only on an account with no history and no
 * name, which meant anyone who had already trained could never get to them —
 * including every account that existed before the form did.
 */
export default async function ProfilePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect('/me');

  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/me');

  // The setup columns arrive with supabase/migrations/0001; before it runs, the
  // select fails as a whole and the base columns are read on their own. Same
  // shape either way, so the form does not need to know which happened.
  const BASE = 'display_name, dominant_foot';
  let initial: ProfileValues = {};
  const { data, error } = await db.from('profiles')
    .select(`${BASE}, age_band, positions, region, club`).eq('id', user.id).maybeSingle();
  if (!error) {
    initial = (data ?? {}) as ProfileValues;
  } else {
    const { data: base } = await db.from('profiles')
      .select(BASE).eq('id', user.id).maybeSingle();
    initial = (base ?? {}) as ProfileValues;
  }

  return (
    <div>
      <BackLink href="/me" label="Me" />
      <ProfileSetup email={user.email} initial={initial} />
    </div>
  );
}
