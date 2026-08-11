import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import type { SessionSpec } from '@/lib/types';

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

const SYSTEM = `You are the Forge training coach for youth footballers.
Read the player's message and record a session spec.
Be generous in interpretation: "before practice" implies a short session; "I want to be
more confident on the ball" implies ball_mastery and first_touch; "get faster" implies speed.
If they mention touches or getting lots of reps on the ball, set priority to "touches".
Keep the reply field to one warm, short sentence. Never invent drill names — you do not choose drills.`;

export async function POST(req: Request) {
  const { message, current } = (await req.json()) as {
    message: string;
    current?: Partial<SessionSpec>;
  };

  // No key configured is a normal state, not a fault — the app is designed to work
  // without one. Answering 200 with a nudge keeps the console clean during testing
  // and tells the player what to do, instead of failing silently behind a 500.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      spec: {},
      reply: 'Free-text is off until an API key is set — use the buttons below and I\'ll build it.',
    });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Haiku is the right tool here: this is structured extraction, not reasoning.
  // ~$1/M in, $5/M out — roughly a tenth of a cent per message. Override with
  // COACH_MODEL if you ever want to trade cost for nuance.
  const res = await anthropic.messages.create({
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

  const block = res.content.find((c) => c.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    return NextResponse.json({ error: 'no spec returned' }, { status: 502 });
  }

  const raw = block.input as Record<string, unknown>;
  // strip nulls so the caller can tell "not mentioned" from "chosen"
  const spec: Partial<SessionSpec> = {};
  if (typeof raw.minutes === 'number') spec.minutes = raw.minutes;
  if (Array.isArray(raw.focus) && raw.focus.length) spec.focus = raw.focus as SessionSpec['focus'];
  if (typeof raw.place === 'string') spec.place = raw.place as SessionSpec['place'];
  if (typeof raw.level === 'string') spec.level = raw.level;
  if (typeof raw.priority === 'string') spec.priority = raw.priority as SessionSpec['priority'];

  return NextResponse.json({ spec, reply: String(raw.reply ?? '') });
}
