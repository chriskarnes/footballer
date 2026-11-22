import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import type { SessionSpec } from '@/lib/types';
import { serverClient } from '@/lib/supabase/server';
import { libraryAllowed } from '@/lib/library-gate';
import { isUnder13 } from '@/lib/child';
import { staffSomewhere } from '@/lib/consent-server';

export const runtime = 'nodejs';

/**
 * The coach turns free text into a SessionSpec — nothing more.
 *
 * It does NOT choose drills. Drill selection stays in src/lib/session-builder.ts
 * so results are deterministic, instant, free, and cannot reference a drill that
 * doesn't exist. The model does the one job it's actually better at: reading
 * "20 min, first touch, at home, before practice" and filling in the blanks.
 */
const SPEC_TOOL = {
  name: 'set_session_spec',
  description:
    'Record what the player asked for. Only fill fields the player actually implied; leave the rest null so the app can ask.',
  input_schema: {
    type: 'object' as const,
    properties: {
      minutes: { type: ['integer', 'null'], description: 'Minutes available, 5-180' },
      focus: {
        type: ['array', 'null'],
        items: {
          type: 'string',
          enum: ['first_touch','ball_mastery','juggling','dribbling','passing','finishing',
                 'crossing','weak_foot','speed','agility','power','strength','core',
                 'conditioning','mobility'],
        },
        description: 'What they want to work on. Multiple allowed.',
      },
      place: { type: ['string', 'null'], enum: ['any','home','pitch','gym', null] },
      level: { type: ['string', 'null'], enum: ['any','Beginner','Advanced','Elite', null] },
      priority: {
        type: ['string', 'null'], enum: ['touches','balanced', null],
        description: '"touches" when they want maximum ball contact or mention the 1,000-touch goal',
      },
      reply: { type: 'string', description: 'One friendly sentence back to the player.' },
    },
    required: ['reply'],
  },
};

const SYSTEM = `You are the Train.futbol training coach for youth footballers.
Read the player's message and record a session spec.
Be generous in interpretation: "before practice" implies a short session; "I want to be
more confident on the ball" implies ball_mastery and first_touch; "get faster" implies speed.
If they mention touches or getting lots of reps on the ball, set priority to "touches".
Keep the reply field to one warm, short sentence. Never invent drill names — you do not choose drills.`;

// A few messages a minute per account, per server instance: enough for anyone
// typing, not for a script spending the key. Best effort (instances don't share
// it); signing in is the real gate.
const RECENT = new Map<string, number[]>();
const PER_MINUTE = 6;
/** Typed sessions a day per account. */
const PER_DAY = Number(process.env.COACH_DAILY_LIMIT) || 40;

function tooMany(user: string) {
  const now = Date.now();
  const times = (RECENT.get(user) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= PER_MINUTE) { RECENT.set(user, times); return true; }
  times.push(now);
  RECENT.set(user, times);
  if (RECENT.size > 5000) RECENT.clear();
  return false;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: unknown; current?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 300) : '';
  const current = body?.current && typeof body.current === 'object' && JSON.stringify(body.current).length <= 1000
    ? body.current as Partial<SessionSpec> : undefined;
  if (!message) return NextResponse.json({ error: 'empty' }, { status: 400 });

  // Signed-in players only: each message costs money, and an open endpoint is
  // one anyone can loop. The buttons build a session without it.
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ reply: 'Sign in to describe a session in your own words. The buttons above work without it.' }, { status: 401 });
  }
  // Not for a player under 13 (0043): what they type would go to the AI
  // company. The app doesn't offer the box to them; this is the same door twice.
  const { data: prof } = await db.from('profiles').select('age_band').eq('id', user.id).maybeSingle();
  if (isUnder13((prof as { age_band: string | null } | null)?.age_band) && !(await staffSomewhere(db, user.id))) {
    return NextResponse.json({ reply: 'Use the buttons above to make a session.' }, { status: 403 });
  }
  // Only where the session builder is: it builds from the drill library, so
  // anywhere without it there's nothing for a description to become.
  if (!(await libraryAllowed().catch(() => false))) {
    return NextResponse.json({ reply: 'The session builder isn’t on here.' }, { status: 403 });
  }
  if (tooMany(user.id)) {
    return NextResponse.json({ reply: 'That’s a lot at once. Give it a minute, or use the buttons above.' }, { status: 429 });
  }

  // No key configured is a normal state, not a fault — the app is designed to work
  // without one. Answering 200 with a nudge keeps the console clean during testing
  // and tells the player what to do, instead of failing silently behind a 500.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      spec: {},
      reply: 'Free-text is off until an API key is set. Use the buttons above and I’ll build it.',
    });
  }

  // The limit that lasts (0035): so many a day per account, counted in the
  // database, where every server instance sees the same number. Before the
  // migration runs there's only the counter above.
  const gate = await db.rpc('coach_allow', { p_per_day: PER_DAY });
  if (gate.error ? gate.error.code !== 'PGRST202' : gate.data !== true) {
    if (gate.error) console.error('[coach] coach_allow', gate.error.message);
    return NextResponse.json({ reply: 'That’s all the typed sessions for today. The buttons above still build one.' }, { status: 429 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Haiku is the right tool here: this is structured extraction, not reasoning.
  // ~$1/M in, $5/M out — roughly a tenth of a cent per message. Override with
  // COACH_MODEL if you ever want to trade cost for nuance.
  let res: Anthropic.Message;
  try {
    res = await anthropic.messages.create({
    model: process.env.COACH_MODEL ?? 'claude-haiku-4-5',
    max_tokens: 400,
    system: SYSTEM,
    tools: [SPEC_TOOL],
    tool_choice: { type: 'tool', name: 'set_session_spec' },
    messages: [
      {
        role: 'user',
        content:
          (current && Object.keys(current).length
            ? `Already known: ${JSON.stringify(current)}\n\n`
            : '') + `Player says: ${message}`,
      },
    ],
    });
  } catch (e) {
    console.error('[coach]', e);
    return NextResponse.json({ error: 'model failed' }, { status: 502 });
  }

  const block = res.content.find((c) => c.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    return NextResponse.json({ error: 'no spec returned' }, { status: 502 });
  }

  const raw = block.input as Record<string, unknown>;
  // strip nulls so the caller can tell "not mentioned" from "chosen"
  const spec: Partial<SessionSpec> = {};
  if (typeof raw.minutes === 'number' && Number.isFinite(raw.minutes)) spec.minutes = Math.max(5, Math.min(180, Math.round(raw.minutes)));
  if (Array.isArray(raw.focus) && raw.focus.length) spec.focus = raw.focus as SessionSpec['focus'];
  if (typeof raw.place === 'string') spec.place = raw.place as SessionSpec['place'];
  if (typeof raw.level === 'string') spec.level = raw.level;
  if (typeof raw.priority === 'string') spec.priority = raw.priority as SessionSpec['priority'];

  return NextResponse.json({ spec, reply: String(raw.reply ?? '') });
}
