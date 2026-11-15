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
