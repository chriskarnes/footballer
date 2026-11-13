/**
 * Whether a player still has to answer the profile questions. One rule for
 * every place that asks (Train's redirect, Me's form, joining), so a player
 * can't be sent to Me by one and shown nothing by the other.
 *
 * Name, age and positions: what the trainer and the week builder use. The
 * foot is asked alongside but older profiles predate it.
 */
export type ProfileFields = { display_name?: string | null; age_band?: string | null; positions?: string[] | null };

export function profileMissing(p: ProfileFields | null | undefined): boolean {
  return !p?.display_name?.trim() || !p.age_band || !Array.isArray(p.positions) || !p.positions.length;
}

/** The same, read from the database for the signed-in player. Errors count as answered. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readProfileMissing(db: any, userId: string): Promise<boolean> {
  const { data, error } = await db.from('profiles').select('display_name, age_band, positions').eq('id', userId).maybeSingle();
  return !error && profileMissing(data);
}
