/**
 * A player's name is never sent to the AI. Where a note should name them,
 * the AI is asked to write {name}, and the name goes in here, on our own
 * server, once its answer is back.
 */
export const NAME_SLOT = '{name}';

export function putName(text: string, first: string | null | undefined): string {
  const name = (first ?? '').trim();
  if (name) return text.split(NAME_SLOT).join(name);
  // No name to put in: the slot comes out, with the comma or space that went with it.
  return text
    .replace(/\{name\}\s*[,:]\s*/g, '')
    .replace(/\s*,?\s*\{name\}/g, '')
    .replace(/^\s*([a-z])/, (_, c: string) => c.toUpperCase())
    .trim();
}

/** One session from the AI, or null when it isn't one. */
export function cleanProposed(x: unknown, first: string): { name: string; new_drill_ids: string[]; note?: string } {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const ok = typeof o.name === 'string' && Array.isArray(o.new_drill_ids);
  // An entry that keeps its place (sessions are matched by position) but
  // changes nothing: no new drills, and the rules' own name.
  if (!ok) return null as unknown as { name: string; new_drill_ids: string[]; note?: string };
  return {
    name: o.name as string,
    new_drill_ids: (o.new_drill_ids as unknown[]).filter((id): id is string => typeof id === 'string'),
    ...(typeof o.note === 'string' ? { note: putName(o.note, first) } : {}),
  };
}
