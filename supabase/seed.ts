/**
 * Seeds the library into Supabase. Idempotent — safe to re-run after you
 * re-parse the PDFs and regenerate data/forge-library.json.
 *
 *   npm run seed
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

type Lib = {
  programs: any[];
  sessions: any[];
  exercises: any[];
};

async function chunkUpsert(table: string, rows: any[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const { error } = await db.from(table).upsert(slice, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
    process.stdout.write(`  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${table}: ${rows.length} rows`.padEnd(40));
}

async function main() {
  const lib: Lib = JSON.parse(
    readFileSync(resolve(process.cwd(), 'data/forge-library.json'), 'utf8')
  );
  console.log('Seeding Forge library…');
  // order matters: programs -> sessions -> exercises (foreign keys)
  await chunkUpsert('programs', lib.programs);
  await chunkUpsert('sessions', lib.sessions);
  await chunkUpsert('exercises', lib.exercises);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
