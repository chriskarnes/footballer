/** A fresh id for one save (a finish, a week), so sending it twice counts once. randomUUID needs a secure page; a local address over plain http hasn't one. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const h = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0'));
  h[6] = '4' + h[6][1]; h[8] = ((parseInt(h[8], 16) & 0x3f) | 0x80).toString(16);
  const x = h.join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
