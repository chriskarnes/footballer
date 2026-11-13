import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { plain } from '@/lib/plain-error';
import { POSITIONS, positionName } from '@/lib/positions';

const AGE_BANDS = ['u10', '10_12', '13_15', '16_18', '18_plus'];
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

  const body = await req.json();
  // Capped like the trainer's own name (60), and positions only from the list
  // the form offers (old names read as today's), each once.
  const text = (v: unknown, max: number) => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
  const name = text(body.display_name, 60);
  const foot = body.dominant_foot;
  const ageBand = body.age_band;
  const positions: string[] = Array.isArray(body.positions)
    ? [...new Set((body.positions as unknown[]).filter((p): p is string => typeof p === 'string').map(positionName))]
        .filter((p) => POSITIONS.includes(p))
    : [];

  // The four required answers are validated; the two optional ones are text the
  // player typed about themselves and are stored as given.
  if (!name) return NextResponse.json({ error: 'a name is required' }, { status: 400 });
  if (!AGE_BANDS.includes(ageBand)) return NextResponse.json({ error: 'invalid age band' }, { status: 400 });
  if (!FEET.includes(foot)) return NextResponse.json({ error: 'invalid dominant foot' }, { status: 400 });
  if (!positions.length) return NextResponse.json({ error: 'at least one position is required' }, { status: 400 });

  const full = {
    id: user.id,
    display_name: name,
    dominant_foot: foot,
    // The singular column predates this form and still has callers. The first
    // position keeps it meaningful rather than leaving it to drift out of date.
    position: positions[0],
    age_band: ageBand,
    positions,
    region: text(body.region, 80) || null,
    club: text(body.club, 80) || null,
  };

  const { error } = await db.from('profiles').upsert(full);
  if (!error) return NextResponse.json({ ok: true, stored: 'all' });

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
