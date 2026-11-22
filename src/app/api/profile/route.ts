import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { plain } from '@/lib/plain-error';
import { POSITIONS, positionName } from '@/lib/positions';
import { AGE_BANDS as BANDS, isUnder13, shortName } from '@/lib/child';
import { staffSomewhere } from '@/lib/consent-server';

const AGE_BANDS = BANDS.map(([v]) => v);
const FEET = ['left', 'right', 'both'];

/** Columns added by supabase/migrations/0001_profile_setup_fields.sql. */
const NEW_COLUMNS = ['age_band', 'positions', 'region', 'club'] as const;

/**
 * The four setup answers, plus the two optional ones.
 *
 * Written with the new columns and, if the migration has not run yet, written
 * again without them. The deploy and the migration are two separate acts by
 * two different hands, and the order between them should not decide whether a
 * ten-year-old's first four answers survive: what can be stored, is. What
 * cannot is reported in `stored`, so the caller is not told everything landed
 * when half of it did.
 */
export async function POST(req: Request) {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  // Not JSON: a 400, which the phone's queue takes as final. A 500 it sends again for ever.
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'bad request' }, { status: 400 });
  // Capped like the trainer's own name (60), and positions only from the list
  // the form offers (old names read as today's), each once.
  const text = (v: unknown, max: number) => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
  // A first name and last initial, never a full name (0043).
  const name = shortName(text(body.display_name, 60));
  const foot = body.dominant_foot;
  const ageBand = body.age_band;
  const positions: string[] = Array.isArray(body.positions)
    ? [...new Set((body.positions as unknown[]).filter((p): p is string => typeof p === 'string').map(positionName))]
        .filter((p) => POSITIONS.includes(p))
    : [];

  // The four required answers are validated; the two optional ones are text the
  // player typed about themselves and are stored as given.
  // keep_name: a trainer here as a player keeps the name their own players know.
  const keepName = body.keep_name === true;
  if (!name && !keepName) return NextResponse.json({ error: 'a name is required' }, { status: 400 });
  if (!AGE_BANDS.includes(ageBand)) return NextResponse.json({ error: 'invalid age band' }, { status: 400 });
  if (!FEET.includes(foot)) return NextResponse.json({ error: 'invalid dominant foot' }, { status: 400 });
  if (!positions.length) return NextResponse.json({ error: 'at least one position is required' }, { status: 400 });

  // Under 13 (0043), unless this is a trainer here for their own child: no
  // photo, club or area kept, and the age isn't raised past 12 until a
  // parent or guardian has agreed, so it can't be used to get round them.
  const staff = await staffSomewhere(db, user.id).catch(() => false);
  const child = isUnder13(ageBand) && !staff;
  if (!staff && !isUnder13(ageBand)) {
    const { data: was } = await db.from('profiles').select('age_band').eq('id', user.id).maybeSingle();
    if (isUnder13((was as { age_band: string | null } | null)?.age_band)) {
      const { data: c, error: ce } = await db.from('parent_consents').select('agreed_at').eq('user_id', user.id).maybeSingle();
      if (!ce && !(c as { agreed_at: string | null } | null)?.agreed_at) {
        return NextResponse.json({ error: 'A parent or guardian agrees first. After that, the age can be changed.' }, { status: 409 });
      }
    }
  }

  const full = {
    id: user.id,
    ...(keepName ? {} : { display_name: name }),
    dominant_foot: foot,
    // The singular column predates this form and still has callers. The first
    // position keeps it meaningful rather than leaving it to drift out of date.
    position: positions[0],
    age_band: ageBand,
    positions,
    region: child ? null : text(body.region, 80) || null,
    club: child ? null : text(body.club, 80) || null,
  };

  const { error } = await db.from('profiles').upsert(full);
  if (!error) {
    // A photo added before the age was set goes now. Before 0016 there's no column: nothing to clear.
    if (child) await db.from('profiles').update({ avatar_type: null, avatar_data: null, avatar_updated_at: null }).eq('id', user.id);
    return NextResponse.json({ ok: true, stored: 'all' });
  }

  // PGRST204 is PostgREST for "no such column", which here means exactly one
  // thing: the migration has not been run yet. Any other failure is real.
  const missingColumn = error.code === 'PGRST204' || /column .* does not exist/i.test(error.message);
  if (!missingColumn) return NextResponse.json({ error: plain(error) }, { status: 400 });

  const legacy = Object.fromEntries(
    Object.entries(full).filter(([k]) => !NEW_COLUMNS.includes(k as typeof NEW_COLUMNS[number]))
  );
  const { error: legacyError } = await db.from('profiles').upsert(legacy);
  if (legacyError) return NextResponse.json({ error: plain(legacyError) }, { status: 400 });

  return NextResponse.json({ ok: true, stored: 'partial', missing: NEW_COLUMNS });
}
